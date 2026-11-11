import { AnalyticsEvent } from "config/analyticsConfig";
import { logger } from "config/logger";
import { isE2ETest, isPreviewBuild } from "helpers/isEnv";
import JailMonkey from "jail-monkey";
import { analytics } from "services/analytics";

export const isDeviceJailbroken = (): boolean => {
  // Skip jail-monkey check for e2e tests as isJailBroken()
  // can return "true" for emulators/simulators in CI env.
  //
  // Preview builds skip it for exactly the same reason: they are only ever
  // installed on an emulator or simulator, where a false positive renders
  // SecurityBlockScreen and makes the build impossible to review.
  if (isE2ETest || isPreviewBuild) {
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
