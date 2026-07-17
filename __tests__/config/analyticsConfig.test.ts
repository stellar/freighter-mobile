import {
  AnalyticsEvent,
  AnalyticsFlow,
  ROUTE_TO_ANALYTICS_EVENT_MAP,
  ROUTES_WITHOUT_ANALYTICS,
  routeToScreenName,
  processRouteForAnalytics,
  buildScreenViewedProps,
  getScreenViewedProps,
  isScreenViewEvent,
} from "config/analyticsConfig";

describe("Analytics Configuration", () => {
  describe("Route Transformation", () => {
    it("should derive canonical screen_names from route names", () => {
      expect(routeToScreenName("WelcomeScreen")).toBe("welcome");
      expect(routeToScreenName("SettingsScreen")).toBe("settings");
      expect(routeToScreenName("SwapAmountScreen")).toBe("swap_amount");
    });

    it("should handle routes without Screen suffix", () => {
      expect(routeToScreenName("Home")).toBe("home");
      expect(routeToScreenName("History")).toBe("history");
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

  describe("screen.viewed consolidation (Slice B, #2883)", () => {
    it("exposes the single canonical screen event", () => {
      expect(AnalyticsEvent.SCREEN_VIEWED).toBe("screen.viewed");
    });

    describe("routeToScreenName", () => {
      it("collapses each run of non-alphanumeric chars into a single underscore", () => {
        expect(routeToScreenName("ReAuthDetailsScreen")).toBe(
          "re_auth_details",
        );
      });

      it("yields a valid slug for every route in the map", () => {
        Object.values(ROUTE_TO_ANALYTICS_EVENT_MAP)
          .filter((name): name is string => name !== null)
          .forEach((name) => {
            expect(name).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
          });
      });
    });

    describe("isScreenViewEvent", () => {
      it("recognises catalogued screen_names and rejects the rest", () => {
        expect(isScreenViewEvent(AnalyticsEvent.VIEW_HOME)).toBe(true);
        expect(isScreenViewEvent(AnalyticsEvent.SCREEN_VIEWED)).toBe(false);
        expect(isScreenViewEvent(AnalyticsEvent.SEND_PAYMENT_SUCCESS)).toBe(
          false,
        );
      });
    });

    describe("buildScreenViewedProps", () => {
      it("uses the catalogued screen_name and assigns the screen's flow", () => {
        expect(buildScreenViewedProps(AnalyticsEvent.VIEW_SEND_AMOUNT)).toEqual(
          {
            screen_name: "send_payment_amount",
            flow: AnalyticsFlow.SEND,
          },
        );
        expect(buildScreenViewedProps(AnalyticsEvent.VIEW_DISCOVERY)).toEqual({
          screen_name: "discover",
          flow: AnalyticsFlow.DISCOVERY,
        });
      });

      it("adds a step for completion/sub-step screens", () => {
        expect(
          buildScreenViewedProps(AnalyticsEvent.VIEW_SEND_CONFIRM),
        ).toEqual({
          screen_name: "send_payment_confirm",
          flow: AnalyticsFlow.SEND,
          step: "confirm",
        });
        expect(
          buildScreenViewedProps(AnalyticsEvent.VIEW_SEND_PROCESSING),
        ).toEqual({
          screen_name: "send_payment_processing",
          flow: AnalyticsFlow.SEND,
          step: "processing",
        });
        expect(
          buildScreenViewedProps(AnalyticsEvent.VIEW_SWAP_CONFIRM),
        ).toEqual({
          screen_name: "swap_confirm",
          flow: AnalyticsFlow.SWAP,
          step: "confirm",
        });
      });

      it("carries no flow for an uncatalogued (auto-mapped) route", () => {
        // Auto-mapped routes not in SCREEN_CATALOG still emit screen.viewed
        // with their route-derived screen_name but carry no flow.
        expect(
          buildScreenViewedProps(routeToScreenName("SomeFutureScreen")),
        ).toEqual({ screen_name: "some_future" });
      });

      it("produces a valid screen_name for every catalogued screen", () => {
        Object.values(AnalyticsEvent)
          .filter((value) => isScreenViewEvent(value))
          .forEach((screenName) => {
            const props = buildScreenViewedProps(screenName);
            expect(props.screen_name).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
            if (props.flow) {
              expect(Object.values(AnalyticsFlow)).toContain(props.flow);
            }
          });
      });
    });

    describe("getScreenViewedProps (manual retarget helper)", () => {
      it("retargets legacy screen events (incl. bottom-sheet ones) to screen.viewed props", () => {
        expect(getScreenViewedProps(AnalyticsEvent.VIEW_SEND_CONFIRM)).toEqual({
          screen_name: "send_payment_confirm",
          flow: AnalyticsFlow.SEND,
          step: "confirm",
        });
        expect(
          getScreenViewedProps(
            AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS,
          ),
        ).toEqual({
          screen_name: "sign_transaction_details",
          flow: AnalyticsFlow.SIGNING,
        });
      });

      it("returns null for non-screen events so they pass through unchanged", () => {
        expect(
          getScreenViewedProps(AnalyticsEvent.SEND_PAYMENT_SUCCESS),
        ).toBeNull();
        expect(getScreenViewedProps(AnalyticsEvent.SCREEN_VIEWED)).toBeNull();
      });
    });

    describe("route path feeds screen.viewed (hard cutover)", () => {
      it("resolves routes to a screen_name that maps to screen.viewed props", () => {
        // processRouteForAnalytics returns the canonical screen_name; the
        // navigation hook feeds it through buildScreenViewedProps.
        const welcome = processRouteForAnalytics("WelcomeScreen");
        expect(welcome).toBe(AnalyticsEvent.VIEW_WELCOME);
        expect(buildScreenViewedProps(welcome!)).toEqual({
          screen_name: "welcome",
          flow: AnalyticsFlow.ONBOARDING,
        });

        const settings = processRouteForAnalytics("SettingsScreen");
        expect(buildScreenViewedProps(settings!)).toEqual({
          screen_name: "settings",
          flow: AnalyticsFlow.SETTINGS,
        });
      });
    });
  });
});
