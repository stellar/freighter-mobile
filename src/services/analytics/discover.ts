import { AnalyticsEvent } from "config/analyticsConfig";
import { DiscoverProtocol } from "config/types";
import { findMatchedProtocol } from "helpers/protocols";
import { track } from "services/analytics/core";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Strip query parameters and fragments from a URL to avoid leaking
 *  sensitive data (tokens, session IDs) to the analytics backend. */
const stripQueryParams = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
};

// -----------------------------------------------------------------------------
// SOURCE CONSTANTS
// -----------------------------------------------------------------------------

export const DISCOVER_ANALYTICS_SOURCE = {
  TRENDING_CAROUSEL: "trending_carousel",
  RECENT_LIST: "recent_list",
  DAPPS_LIST: "dapps_list",
  EXPANDED_RECENT_LIST: "expanded_recent_list",
  EXPANDED_DAPPS_LIST: "expanded_dapps_list",
  URL_BAR: "url_bar",
  TAB_OVERVIEW: "tab_overview",
  AUTOMATIC: "automatic",
} as const;

export type DiscoverAnalyticsSource =
  (typeof DISCOVER_ANALYTICS_SOURCE)[keyof typeof DISCOVER_ANALYTICS_SOURCE];

// -----------------------------------------------------------------------------
// DISCOVER ANALYTICS
// -----------------------------------------------------------------------------

export const trackDiscoverProtocolOpened = (
  url: string,
  source: DiscoverAnalyticsSource,
  protocols: DiscoverProtocol[],
): void => {
  const matchedProtocol = findMatchedProtocol({ protocols, searchUrl: url });
  track(AnalyticsEvent.DISCOVER_PROTOCOL_OPENED, {
    url: stripQueryParams(url),
    protocol_name: matchedProtocol?.name,
    source,
    is_known_protocol: !!matchedProtocol,
  });
};

export const trackDiscoverProtocolDetailsViewed = (
  protocolName: string,
  tags: string[],
): void => {
  track(AnalyticsEvent.DISCOVER_PROTOCOL_DETAILS_VIEWED, {
    protocol_name: protocolName,
    tags,
  });
};

export const trackDiscoverProtocolOpenedFromDetails = (
  protocolName: string,
  url: string,
): void => {
  track(AnalyticsEvent.DISCOVER_PROTOCOL_OPENED_FROM_DETAILS, {
    protocol_name: protocolName,
    url: stripQueryParams(url),
  });
};

export const trackDiscoverTabCreated = (
  tabCount: number,
  source: DiscoverAnalyticsSource,
): void => {
  // Skip automatic tabs (e.g. replacement after closing the last tab) —
  // only track intentional user-initiated tab creations.
  if (source === DISCOVER_ANALYTICS_SOURCE.AUTOMATIC) return;

  track(AnalyticsEvent.DISCOVER_TAB_CREATED, {
    tab_count_after_create: tabCount,
    source,
  });
};

export const trackDiscoverTabClosed = (
  tabCountBeforeClose: number,
  hadUrl: string | undefined,
): void => {
  track(AnalyticsEvent.DISCOVER_TAB_CLOSED, {
    tab_count_before_close: tabCountBeforeClose,
    had_url: hadUrl ? stripQueryParams(hadUrl) : undefined,
  });
};

export const trackDiscoverAllTabsClosed = (
  tabCountBeforeClose: number,
): void => {
  track(AnalyticsEvent.DISCOVER_ALL_TABS_CLOSED, {
    tab_count_before_close: tabCountBeforeClose,
  });
};

export const trackDiscoverWelcomeModalViewed = (): void => {
  track(AnalyticsEvent.DISCOVER_WELCOME_MODAL_VIEWED);
};
