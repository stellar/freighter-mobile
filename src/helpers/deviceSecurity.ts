import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import JailMonkey from "jail-monkey";
import { analytics } from "services/analytics";

export const isDeviceJailbroken = (): boolean => {
  try {
    const isJailBroken = JailMonkey.isJailBroken();
    if (isJailBroken) {
      analytics.track(AnalyticsEvent.DEVICE_JAILBREAK_DETECTED);
    }
    return isJailBroken;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("isDeviceJailbroken", "isJailBroken", errorMessage);
    analytics.track(AnalyticsEvent.DEVICE_JAILBREAK_FAILED);
    return false;
  }
};
