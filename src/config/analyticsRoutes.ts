import type { AnalyticsEvent } from "config/analyticsEvents";
import { logger } from "config/logger";
import {
  AUTH_STACK_ROUTES,
  BUY_XLM_ROUTES,
  MAIN_TAB_ROUTES,
  MANAGE_ASSETS_ROUTES,
  MANAGE_WALLETS_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  SEND_PAYMENT_ROUTES,
  SETTINGS_ROUTES,
  SWAP_ROUTES,
} from "config/routes";

/**
 * Analytics Route Mapping
 *
 * Maps React Navigation routes to analytics events using automatic transformation.
 *
 * ## How it works:
 * 1. **Automatic**: "WelcomeScreen" → "loaded screen: welcome"
 * 2. **Automatic**: "SettingsScreen" → "loaded screen: settings"
 * 3. **Override only**: Special cases that don't follow the pattern
 *
 * ## Adding new screens:
 * 1. Add route to routes.ts (normal process)
 * 2. Analytics tracking works automatically ✨
 * 3. Only add override if the auto-generated name is wrong
 */

// Routes that should NOT have analytics events
const ROUTES_WITHOUT_ANALYTICS = new Set<string>([
  // Navigator-level routes (not actual screens)
  "MainTabStack",
  "AuthStack",
  "SettingsStack",
  "SendPaymentStack",
  "SwapStack",
  "ManageAssetsStack",
  "ManageWalletsStack",
  "BuyXLMStack",
]);

// Manual overrides ONLY for routes that don't follow the auto-transformation pattern
const CUSTOM_ROUTE_MAPPINGS: Record<string, AnalyticsEvent> = {
  [AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN]:
    "loaded screen: account creator" as AnalyticsEvent,
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN]:
    "loaded screen: mnemonic phrase alert" as AnalyticsEvent,
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN]:
    "loaded screen: mnemonic phrase" as AnalyticsEvent,
  [AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN]:
    "loaded screen: confirm mnemonic phrase" as AnalyticsEvent,
  [AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN]:
    "loaded screen: import account" as AnalyticsEvent,
  [ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN]:
    "loaded screen: unlock account" as AnalyticsEvent,
  [MAIN_TAB_ROUTES.TAB_HOME]: "loaded screen: account" as AnalyticsEvent,
  [MAIN_TAB_ROUTES.TAB_HISTORY]:
    "loaded screen: account history" as AnalyticsEvent,
  [MAIN_TAB_ROUTES.TAB_DISCOVERY]: "loaded screen: discover" as AnalyticsEvent,
  [ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN]:
    "loaded screen: view public key generator" as AnalyticsEvent,
  [ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN]:
    "loaded screen: asset detail" as AnalyticsEvent,
  [SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN]:
    "loaded screen: send payment to" as AnalyticsEvent,
  [SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN]:
    "loaded screen: send payment amount" as AnalyticsEvent,
  [SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN]:
    "loaded screen: send payment settings" as AnalyticsEvent,
  [SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN]:
    "loaded screen: send payment fee" as AnalyticsEvent,
  [SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN]:
    "loaded screen: send payment timeout" as AnalyticsEvent,
  [SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN]:
    "loaded screen: manage network" as AnalyticsEvent,
  [SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN]:
    "loaded screen: leave feedback" as AnalyticsEvent,
  [SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN]:
    "loaded screen: show recovery phrase" as AnalyticsEvent,
  [BUY_XLM_ROUTES.BUY_XLM_SCREEN]: "loaded screen: add fund" as AnalyticsEvent,
};

/**
 * Safely checks if a string is valid and non-empty.
 */
const isValidString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Transform route name to analytics event name automatically.
 * Examples:
 * - "WelcomeScreen" → "loaded screen: welcome"
 * - "SettingsScreen" → "loaded screen: settings"
 * - "SwapAmountScreen" → "loaded screen: swap amount"
 */
const transformRouteToEventName = (routeName: string): string => {
  // Remove "Screen" suffix if present
  const baseName = routeName.replace(/Screen$/, "");

  // Convert PascalCase to lowercase with spaces
  // "SwapAmount" → "swap amount"
  const withSpaces = baseName
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .toLowerCase()
    .trim();

  return `loaded screen: ${withSpaces}`;
};

/**
 * Gets all route objects to scan for analytics mapping.
 */
const getAllRouteObjects = () =>
  [
    ROOT_NAVIGATOR_ROUTES,
    AUTH_STACK_ROUTES,
    MAIN_TAB_ROUTES,
    MANAGE_ASSETS_ROUTES,
    SETTINGS_ROUTES,
    MANAGE_WALLETS_ROUTES,
    BUY_XLM_ROUTES,
    SEND_PAYMENT_ROUTES,
    SWAP_ROUTES,
  ] as const;

/**
 * Processes a single route for analytics mapping.
 * Uses automatic transformation unless there's a manual override.
 */
const processRoute = (routeName: string): AnalyticsEvent | null => {
  // Check exclusion list first
  if (ROUTES_WITHOUT_ANALYTICS.has(routeName)) {
    return null;
  }

  // Check manual overrides first
  if (CUSTOM_ROUTE_MAPPINGS[routeName]) {
    return CUSTOM_ROUTE_MAPPINGS[routeName];
  }

  // Use automatic transformation for all other routes
  const autoEvent = transformRouteToEventName(routeName);

  return autoEvent as AnalyticsEvent;
};

/**
 * Generates the complete route-to-analytics mapping.
 */
const generateRouteToAnalyticsMapping = () => {
  const mapping: Record<string, AnalyticsEvent | null> = {};
  const allRouteObjects = getAllRouteObjects();

  allRouteObjects.forEach((routeObject) => {
    Object.values(routeObject).forEach((routeName) => {
      const analyticsEvent = processRoute(routeName);

      mapping[routeName] = analyticsEvent;
    });
  });

  return mapping;
};

/**
 * Pre-generated mapping of routes to analytics events.
 */
export const ROUTE_TO_ANALYTICS_EVENT_MAP = generateRouteToAnalyticsMapping();

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
 *   track(event);
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
