import { AnalyticsEvent } from "config/analyticsConfig";
import { DiscoverProtocol } from "config/types";
import {
  DISCOVER_ANALYTICS_SOURCE,
  trackDiscoverProtocolOpened,
  trackDiscoverProtocolDetailsViewed,
  trackDiscoverProtocolOpenedFromDetails,
  trackDiscoverTabCreated,
  trackDiscoverTabClosed,
  trackDiscoverAllTabsClosed,
  trackDiscoverWelcomeModalViewed,
} from "services/analytics/discover";

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

jest.mock("helpers/protocols", () => ({
  findMatchedProtocol: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");
const { findMatchedProtocol } = jest.requireMock("helpers/protocols");

const mockProtocol: DiscoverProtocol = {
  name: "StellarX",
  websiteUrl: "https://stellarx.com",
  description: "A DEX on Stellar",
  tags: ["DEX", "Swap"],
  iconUrl: "https://stellarx.com/icon.png",
  backgroundUrl: "https://stellarx.com/bg.png",
  isTrending: true,
};

const protocols: DiscoverProtocol[] = [mockProtocol];

describe("Discover Analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DISCOVER_ANALYTICS_SOURCE", () => {
    it("should contain all expected source keys", () => {
      expect(DISCOVER_ANALYTICS_SOURCE).toEqual({
        TRENDING_CAROUSEL: "trending_carousel",
        RECENT_LIST: "recent_list",
        DAPPS_LIST: "dapps_list",
        EXPANDED_RECENT_LIST: "expanded_recent_list",
        EXPANDED_DAPPS_LIST: "expanded_dapps_list",
        URL_BAR: "url_bar",
        TAB_OVERVIEW: "tab_overview",
        AUTOMATIC: "automatic",
      });
    });
  });

  describe("trackDiscoverProtocolOpened", () => {
    it("should track with matched protocol name when URL matches a known protocol", () => {
      findMatchedProtocol.mockReturnValue(mockProtocol);

      trackDiscoverProtocolOpened(
        "https://stellarx.com",
        "trending_carousel",
        protocols,
      );

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_PROTOCOL_OPENED,
        {
          url: "https://stellarx.com/",
          protocol_name: "StellarX",
          source: "trending_carousel",
          is_known_protocol: true,
        },
      );
    });

    it("should track with is_known_protocol false when URL does not match", () => {
      findMatchedProtocol.mockReturnValue(undefined);

      trackDiscoverProtocolOpened(
        "https://unknown-site.com",
        "url_bar",
        protocols,
      );

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_PROTOCOL_OPENED,
        {
          url: "https://unknown-site.com/",
          protocol_name: undefined,
          source: "url_bar",
          is_known_protocol: false,
        },
      );
    });

    it("should pass protocols to findMatchedProtocol", () => {
      findMatchedProtocol.mockReturnValue(undefined);

      trackDiscoverProtocolOpened(
        "https://example.com",
        "dapps_list",
        protocols,
      );

      expect(findMatchedProtocol).toHaveBeenCalledWith({
        protocols,
        searchUrl: "https://example.com",
      });
    });
  });

  describe("trackDiscoverProtocolDetailsViewed", () => {
    it("should track with protocol name and tags", () => {
      trackDiscoverProtocolDetailsViewed("StellarX", ["DEX", "Swap"]);

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_PROTOCOL_DETAILS_VIEWED,
        {
          protocol_name: "StellarX",
          tags: ["DEX", "Swap"],
        },
      );
    });
  });

  describe("trackDiscoverProtocolOpenedFromDetails", () => {
    it("should track with protocol name and url", () => {
      trackDiscoverProtocolOpenedFromDetails(
        "StellarX",
        "https://stellarx.com",
      );

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_PROTOCOL_OPENED_FROM_DETAILS,
        {
          protocol_name: "StellarX",
          url: "https://stellarx.com/",
        },
      );
    });
  });

  describe("trackDiscoverTabCreated", () => {
    it("should skip tracking when source is automatic", () => {
      trackDiscoverTabCreated(3, DISCOVER_ANALYTICS_SOURCE.AUTOMATIC);

      expect(track).not.toHaveBeenCalled();
    });

    it("should track for non-automatic sources", () => {
      trackDiscoverTabCreated(3, DISCOVER_ANALYTICS_SOURCE.TAB_OVERVIEW);

      expect(track).toHaveBeenCalledWith(AnalyticsEvent.DISCOVER_TAB_CREATED, {
        tab_count: 3,
        source: "tab_overview",
      });
    });
  });

  describe("trackDiscoverTabClosed", () => {
    it("should track with tab count and had_url", () => {
      trackDiscoverTabClosed(2, "https://example.com");

      expect(track).toHaveBeenCalledWith(AnalyticsEvent.DISCOVER_TAB_CLOSED, {
        tab_count_before_close: 2,
        had_url: "https://example.com/",
      });
    });

    it("should track with undefined had_url when tab had no URL", () => {
      trackDiscoverTabClosed(1, undefined);

      expect(track).toHaveBeenCalledWith(AnalyticsEvent.DISCOVER_TAB_CLOSED, {
        tab_count_before_close: 1,
        had_url: undefined,
      });
    });
  });

  describe("trackDiscoverAllTabsClosed", () => {
    it("should track with tab count", () => {
      trackDiscoverAllTabsClosed(5);

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_ALL_TABS_CLOSED,
        {
          tab_count_before_close: 5,
        },
      );
    });
  });

  describe("trackDiscoverWelcomeModalViewed", () => {
    it("should track with no properties", () => {
      trackDiscoverWelcomeModalViewed();

      expect(track).toHaveBeenCalledWith(
        AnalyticsEvent.DISCOVER_WELCOME_MODAL_VIEWED,
      );
    });
  });
});
