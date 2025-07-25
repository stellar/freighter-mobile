import { MIN_IOS_VERSION_FOR_ATT_REQUEST } from "config/constants";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useEffect, useRef, useCallback, useState } from "react";
import { Platform, AppState, AppStateStatus, Linking } from "react-native";
import { PERMISSIONS, RESULTS, check, request } from "react-native-permissions";
import { analytics } from "services/analytics";
import { initAnalytics } from "services/analytics/core";

interface UseAnalyticsAndPermissionsParams {
  previousState?: string;
}

const shouldSetAttRequested = (result: string) =>
  result === RESULTS.GRANTED ||
  result === RESULTS.DENIED ||
  result === RESULTS.BLOCKED;

// App tracking transparency is supported only on iOS 14 or higher
const isAttSupported =
  Platform.OS === "ios" &&
  parseInt(Platform.Version, 10) >= MIN_IOS_VERSION_FOR_ATT_REQUEST;

/**
 * Hook to manage analytics and tracking permissions
 * Handles all permission logic, analytics state, and platform-specific flows.
 *
 * @param previousState - Optional previous app state for analytics tracking.
 * @returns Object with analytics state, permission state, and handler methods.
 */
export const useAnalyticsAndPermissions = ({
  previousState = "none",
}: UseAnalyticsAndPermissionsParams = {}) => {
  const attRequested = useAnalyticsStore((state) => state.attRequested);
  const isEnabled = useAnalyticsStore((state) => state.isEnabled);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFirstLaunchRef = useRef(true);
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);

  /**
   * Requests tracking permission and updates analytics state accordingly.
   * Only requests if not already requested (iOS 14 or higher only).
   * NOTE: we can only request once as per apple's policy
   *
   * @returns Permission status result.
   */
  const requestTrackingPermission = useCallback(async () => {
    setIsPermissionLoading(true);

    if (!isAttSupported || attRequested) {
      setIsPermissionLoading(false);

      return RESULTS.GRANTED;
    }

    try {
      const result = await request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);

      analytics.setAnalyticsEnabled(result === RESULTS.GRANTED);

      if (shouldSetAttRequested(result)) {
        analytics.setAttRequested(true);
      }

      setIsPermissionLoading(false);

      return result;
    } catch (error) {
      logger.error("App", "Error requesting app tracking transparency", error);

      setIsPermissionLoading(false);

      return RESULTS.UNAVAILABLE;
    }
  }, [attRequested]);

  /**
   * Checks the current tracking permission status and updates analytics state.
   * @returns Permission status result.
   */
  const checkTrackingPermission = useCallback(async () => {
    setIsPermissionLoading(true);

    if (!isAttSupported) {
      analytics.setAnalyticsEnabled(true);
      setIsPermissionLoading(false);

      return RESULTS.GRANTED;
    }

    try {
      const result = await check(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);

      analytics.setAnalyticsEnabled(result === RESULTS.GRANTED);
      setIsPermissionLoading(false);

      return result;
    } catch (error) {
      logger.error("App", "Error checking app tracking transparency", error);

      analytics.setAnalyticsEnabled(false);
      setIsPermissionLoading(false);

      return RESULTS.UNAVAILABLE;
    }
  }, []);

  /**
   * Handles the analytics toggle click.
   * - On iOS 14+, if disabling analytics, also opens device settings for ATT.
   * - On Android or iOS < 14, only disables analytics in-app.
   * - Handles all permission request/enable/disable flows.
   */
  const handleAnalyticsToggleClick = useCallback(async () => {
    setIsPermissionLoading(true);

    if (isAttSupported && isEnabled) {
      await Linking.openSettings();

      setIsPermissionLoading(false);

      return;
    }

    const result = await checkTrackingPermission();

    if (!isAttSupported) {
      analytics.setAnalyticsEnabled(!isEnabled);
      setIsPermissionLoading(false);

      return;
    }

    if (result === RESULTS.GRANTED) {
      analytics.setAnalyticsEnabled(true);
      setIsPermissionLoading(false);

      return;
    }

    if (
      (result === RESULTS.DENIED || result === RESULTS.BLOCKED) &&
      attRequested
    ) {
      await Linking.openSettings();

      setIsPermissionLoading(false);

      return;
    }

    if (result === RESULTS.DENIED && !attRequested) {
      await requestTrackingPermission();

      setIsPermissionLoading(false);
    } else {
      setIsPermissionLoading(false);
    }
  }, [
    attRequested,
    checkTrackingPermission,
    requestTrackingPermission,
    isEnabled,
  ]);

  /**
   * Syncs tracking permission and analytics state (for focus/appstate sync).
   * Should be called on screen focus and app foreground.
   */
  const syncTrackingPermission = useCallback(async () => {
    await checkTrackingPermission();
  }, [checkTrackingPermission]);

  useEffect(() => {
    const handleInit = async () => {
      await requestTrackingPermission();

      initAnalytics();

      await analytics.identifyUser();

      analytics.trackAppOpened({ previousState });
    };

    handleInit();

    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const prevState = appStateRef.current;

      if (nextAppState === "active" && !isFirstLaunchRef.current) {
        analytics.trackAppOpened({ previousState: prevState });

        (async () => {
          await syncTrackingPermission();
        })();
      }

      appStateRef.current = nextAppState;
      isFirstLaunchRef.current = false;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [
    attRequested,
    previousState,
    requestTrackingPermission,
    syncTrackingPermission,
  ]);

  return {
    isTrackingEnabled: isEnabled,
    attRequested,
    handleAnalyticsToggleClick,
    syncTrackingPermission,
    isPermissionLoading,
  };
};
