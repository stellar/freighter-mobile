import {
  AnalyticsEvent,
  ROUTE_TO_ANALYTICS_EVENT_MAP,
  ROUTES_WITHOUT_ANALYTICS,
  CUSTOM_ROUTE_MAPPINGS,
  transformRouteToEventName,
} from "config/analyticsConfig";
import { logger } from "config/logger";

/**
 * Safely checks if a string is valid and non-empty.
 */
const isValidString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
/**
 * Gets analytics event for a route (primary API).
 *
 * @param routeName - Route constant to look up
 * @returns Analytics event or null if not configured
 *
 * @example
 * ```typescript
 * const event = getAnalyticsEventForRoute("WelcomeScreen");
 * if (event) {
 *   analytics.track(event);
 * }
 * ```
 */
export const getAnalyticsEventForRoute = (
  routeName: string,
): AnalyticsEvent | null => {
  if (!isValidString(routeName)) {
    if (__DEV__) {
      logger.warn(
        "🔥 Analytics: ",
        "getAnalyticsEventForRoute called with empty route name",
      );
    }
    return null;
  }

  return ROUTE_TO_ANALYTICS_EVENT_MAP[routeName] || null;
};

/**
 * Checks if a route has analytics configured.
 */
export const hasAnalyticsEvent = (routeName: string): boolean =>
  routeName in ROUTE_TO_ANALYTICS_EVENT_MAP &&
  ROUTE_TO_ANALYTICS_EVENT_MAP[routeName] !== null;

/**
 * Gets all routes that have analytics events configured.
 */
export const getRoutesWithAnalytics = (): string[] =>
  Object.keys(ROUTE_TO_ANALYTICS_EVENT_MAP).filter(
    (route) => ROUTE_TO_ANALYTICS_EVENT_MAP[route] !== null,
  );

/**
 * Gets the expected analytics event name for a route.
 * Uses the same transformation as the actual mapping.
 */
export const getExpectedEventName = (routeName: string): string => {
  if (!isValidString(routeName)) {
    return "";
  }

  // Use the same transformation logic
  return transformRouteToEventName(routeName);
};

/**
 * Debug helper: Shows which routes use auto vs manual mapping.
 * Development only - no-op in production.
 */
export const debugAnalyticsRoutes = (): void => {
  if (!__DEV__) return;

  const routes = Object.keys(ROUTE_TO_ANALYTICS_EVENT_MAP);
  const autoRoutes = routes.filter(
    (route) =>
      ROUTE_TO_ANALYTICS_EVENT_MAP[route] !== null &&
      !CUSTOM_ROUTE_MAPPINGS[route],
  );
  const customRoutes = routes.filter((route) => CUSTOM_ROUTE_MAPPINGS[route]);
  const excludedRoutes = routes.filter((route) =>
    ROUTES_WITHOUT_ANALYTICS.has(route),
  );

  console.group("📊 Analytics Routes Debug");
  console.log(`📋 Total: ${routes.length}`);
  console.log(`🤖 Auto-generated: ${autoRoutes.length}`);
  console.log(`⚙️  Manual overrides: ${customRoutes.length}`);
  console.log(`❌ Excluded: ${excludedRoutes.length}`);

  if (autoRoutes.length > 0) {
    console.log("\n🤖 Auto-generated routes:");
    autoRoutes.forEach((route) => {
      console.log(`  ${route} → ${ROUTE_TO_ANALYTICS_EVENT_MAP[route]}`);
    });
  }

  if (customRoutes.length > 0) {
    console.log("\n⚙️ Manual overrides:");
    customRoutes.forEach((route) => {
      console.log(`  ${route} → ${ROUTE_TO_ANALYTICS_EVENT_MAP[route]}`);
    });
  }

  console.groupEnd();
};
