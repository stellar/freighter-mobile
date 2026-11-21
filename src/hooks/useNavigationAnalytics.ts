import { NavigationState, PartialState } from "@react-navigation/native";
import {
  AnalyticsEvent,
  buildScreenViewedProps,
  processRouteForAnalytics,
} from "config/analyticsConfig";
import { SWAP_ROUTES } from "config/routes";
import { useSwapStore } from "ducks/swap";
import { useRef } from "react";
import { track } from "services/analytics/core";
import { swapSourceProps } from "services/analytics/swapSource";

/**
 * This is a global hook that is used to track all navigation events
 *
 * Whenever the user navigates to a new screen we track the navigation to analytics
 */

type ActiveRoute = { name: string; params?: object };

const getActiveRoute = (
  navigationState: NavigationState | PartialState<NavigationState>,
): ActiveRoute | undefined => {
  if (!navigationState || navigationState.index === undefined) {
    return undefined;
  }

  const route = navigationState.routes[navigationState.index];

  if (route.state) {
    return getActiveRoute(route.state);
  }

  return route;
};

/**
 * Where the swap was opened from, on the Swap stack's screen views, as every
 * other swap event carries it. The amount screen reads it from its route
 * (Home's Swap tile names none); the token picker, pushed over it, from the
 * swap store the amount screen stamped.
 */
const getSwapScreenViewProps = (route: ActiveRoute) => {
  if (route.name === SWAP_ROUTES.SWAP_AMOUNT_SCREEN) {
    const { source } = (route.params ?? {}) as { source?: string };
    return swapSourceProps(source ?? "home");
  }
  if (route.name === SWAP_ROUTES.SWAP_SCREEN) {
    return swapSourceProps(useSwapStore.getState().entrySource);
  }
  return {};
};

export const useNavigationAnalytics = () => {
  const routeNameRef = useRef<string | null>(null);

  const onStateChange = (state: NavigationState | undefined) => {
    if (!state) return;

    const previousRouteName = routeNameRef.current;
    const currentRoute = getActiveRoute(state);
    const currentRouteName = currentRoute?.name ?? "";

    if (currentRoute && previousRouteName !== currentRouteName) {
      // processRouteForAnalytics resolves the route to its canonical
      // screen_name; we emit a single `screen.viewed` event carrying
      // { screen_name, flow } (surface is added by the Slice-A common
      // context).
      const screenName = processRouteForAnalytics(currentRouteName);

      if (screenName) {
        track(AnalyticsEvent.SCREEN_VIEWED, {
          ...buildScreenViewedProps(screenName),
          ...getSwapScreenViewProps(currentRoute),
        });
      }
    }

    routeNameRef.current = currentRouteName;
  };

  return { onStateChange };
};
