import {
  AnalyticsEvent,
  ROUTE_TO_ANALYTICS_EVENT_MAP,
  ROUTES_WITHOUT_ANALYTICS,
  transformRouteToEventName,
  processRouteForAnalytics,
} from "config/analyticsConfig";

describe("Analytics Configuration", () => {
  describe("Route Transformation", () => {
    it("should transform route names correctly", () => {
      expect(transformRouteToEventName("WelcomeScreen")).toBe(
        "loaded screen: welcome",
      );
      expect(transformRouteToEventName("SettingsScreen")).toBe(
        "loaded screen: settings",
      );
      expect(transformRouteToEventName("SwapAmountScreen")).toBe(
        "loaded screen: swap amount",
      );
    });

    it("should handle routes without Screen suffix", () => {
      expect(transformRouteToEventName("Home")).toBe("loaded screen: home");
      expect(transformRouteToEventName("History")).toBe(
        "loaded screen: history",
      );
    });
  });

  describe("Route Processing", () => {
    it("should exclude stack routes", () => {
      expect(processRouteForAnalytics("MainTabStack")).toBeNull();
      expect(processRouteForAnalytics("AuthStack")).toBeNull();
      expect(processRouteForAnalytics("SettingsStack")).toBeNull();
    });

    it("should automatically exclude stack routes", () => {
      expect(ROUTES_WITHOUT_ANALYTICS.has("MainTabStack")).toBe(true);
      expect(ROUTES_WITHOUT_ANALYTICS.has("AuthStack")).toBe(true);
      expect(ROUTES_WITHOUT_ANALYTICS.has("SettingsStack")).toBe(true);
    });

    it("should use custom mappings when available", () => {
      expect(processRouteForAnalytics("ChoosePasswordScreen")).toBe(
        AnalyticsEvent.VIEW_CHOOSE_PASSWORD,
      );
      expect(processRouteForAnalytics("Home")).toBe(AnalyticsEvent.VIEW_HOME);
      expect(processRouteForAnalytics("LockScreen")).toBe(
        AnalyticsEvent.VIEW_LOCK_SCREEN,
      );
    });

    it("should use automatic transformation for other routes", () => {
      expect(processRouteForAnalytics("WelcomeScreen")).toBe(
        AnalyticsEvent.VIEW_WELCOME,
      );
      expect(processRouteForAnalytics("SettingsScreen")).toBe(
        AnalyticsEvent.VIEW_SETTINGS,
      );
    });
  });

  describe("Route Mapping", () => {
    it("should have analytics events for screen routes", () => {
      expect(ROUTE_TO_ANALYTICS_EVENT_MAP.WelcomeScreen).toBe(
        AnalyticsEvent.VIEW_WELCOME,
      );
      expect(ROUTE_TO_ANALYTICS_EVENT_MAP.SettingsScreen).toBe(
        AnalyticsEvent.VIEW_SETTINGS,
      );
      expect(ROUTE_TO_ANALYTICS_EVENT_MAP.Home).toBe(AnalyticsEvent.VIEW_HOME);
    });

    it("should not have analytics events for stack routes", () => {
      expect(ROUTE_TO_ANALYTICS_EVENT_MAP.MainTabStack).toBeNull();
      expect(ROUTE_TO_ANALYTICS_EVENT_MAP.AuthStack).toBeNull();
    });
  });
});
