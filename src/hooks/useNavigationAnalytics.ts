import { NavigationState, PartialState } from "@react-navigation/native";
import {
  AnalyticsEvent,
  buildScreenViewedProps,
  processRouteForAnalytics,
} from "config/analyticsConfig";
import { useRef } from "react";
import { track } from "services/analytics/core";

/**
 * This is a global hook that is used to track all navigation events
 *
 * Whenever the user navigates to a new screen we track the navigation to analytics
 */

const getActiveRouteName = (
  navigationState: NavigationState | PartialState<NavigationState>,
): string => {
  if (!navigationState || navigationState.index === undefined) {
    return "";
  }

  const route = navigationState.routes[navigationState.index];

  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
};

export const useNavigationAnalytics = () => {
  const routeNameRef = useRef<string | null>(null);

  const onStateChange = (state: NavigationState | undefined) => {
    if (!state) return;

    const previousRouteName = routeNameRef.current;
    const currentRouteName = getActiveRouteName(state);

    if (previousRouteName !== currentRouteName) {
      // processRouteForAnalytics still resolves the route to its legacy
      // "loaded screen: X" string; Slice B retargets that into a single
      // canonical `screen.viewed` event carrying { screen_name, flow }
      // (surface is added by the Slice-A common context).
      const legacyScreenEvent = processRouteForAnalytics(currentRouteName);

      if (legacyScreenEvent) {
        track(
          AnalyticsEvent.SCREEN_VIEWED,
          buildScreenViewedProps(legacyScreenEvent),
        );
      }
    }

    routeNameRef.current = currentRouteName;
  };

  return { onStateChange };
};
