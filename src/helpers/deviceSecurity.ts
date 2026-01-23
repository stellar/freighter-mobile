import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { isE2ETest } from "helpers/isEnv";
import JailMonkey from "jail-monkey";
import { analytics } from "services/analytics";

export const isDeviceJailbroken = (): boolean => {
  // Skip jail-monkey check for e2e tests as
  // isJailBroken() returns "true" for the CI devices
  if (isE2ETest) {
    return false;
  }

  try {
    const isJailBroken = JailMonkey.isJailBroken();
    if (isJailBroken) {
      analytics.track(AnalyticsEvent.DEVICE_JAILBREAK_DETECTED);
    }
    return isJailBroken;
  } catch (error) {
    logger.error("isDeviceJailbroken", "isJailBroken", error);
    analytics.track(AnalyticsEvent.DEVICE_JAILBREAK_FAILED);
    return false;
  }
};
