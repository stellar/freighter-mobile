import { MIN_IOS_VERSION_FOR_ATT_REQUEST } from "config/constants";
import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import useDebounce from "hooks/useDebounce";
import { useEffect, useRef, useCallback, useState } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  openSettings,
} from "react-native-permissions";
import { analytics } from "services/analytics";
import { initAnalytics } from "services/analytics/core";

interface UseAnalyticsPermissionsParams {
  previousState?: AppStateStatus | "none";
}

interface UseAnalyticsPermissionsReturn {
  isTrackingEnabled: boolean;
  isAttRequested: boolean;
  handleAnalyticsToggle: () => Promise<void>;
  syncTrackingPermission: () => void;
  isPermissionLoading: boolean;
  showPermissionModal: boolean;
  setShowPermissionModal: (visible: boolean) => void;
  handleOpenSettings: () => Promise<void>;
  permissionAction: "enable" | "disable";
}

type PermissionAction = "enable" | "disable";

const DEFAULT_PREVIOUS_STATE = "none";
const SYNC_DEBOUNCE_DELAY = 100;

const shouldMarkAttAsRequested = (result: string): boolean =>
  result === RESULTS.GRANTED ||
  result === RESULTS.DENIED ||
  result === RESULTS.BLOCKED;

const isAttSupported = (): boolean =>
  Platform.OS === "ios" &&
  parseFloat(Platform.Version) >= MIN_IOS_VERSION_FOR_ATT_REQUEST;

/**
 * Custom hook for managing analytics tracking permissions across platforms.
 *
 * Handles App Tracking Transparency (ATT) on iOS 14.5 and higher using device settings.
 * and store settings for android and older iOS versions.
 *
 * NOTE: we currently uses iOS 15 as the minimum version for our app
 * But we should keep the fallback for lower versions nontheless
 *
 * @param params - Configuration parameters
 * @param params.previousState - Previous app state for analytics tracking
 * @returns Object containing permission state and management functions
 *
 * @example
 * ```typescript
 * const {
 *   isTrackingEnabled,
 *   handleAnalyticsToggle,
 *   isPermissionLoading
 * } = useAnalyticsPermissions({ previousState: 'background' });
 * ```
 */
export const useAnalyticsPermissions = ({
  previousState = DEFAULT_PREVIOUS_STATE,
}: UseAnalyticsPermissionsParams = {}): UseAnalyticsPermissionsReturn => {
  const isAttRequested = useAnalyticsStore((state) => state.attRequested);
  const isEnabled = useAnalyticsStore((state) => state.isEnabled);

  const [isPermissionLoading, setIsPermissionLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionAction, setPermissionAction] =
    useState<PermissionAction>("enable");

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isInitialLaunchRef = useRef(true);

  /**
   * Checks current tracking permission status and updates analytics state.
   *
   * For ATT platforms: Queries device settings and sets analytics state accordingly.
   * For non-ATT platforms: Returns GRANTED (no device permissions to check).
   *
   * @returns Promise resolving to permission status
   */
  const checkTrackingPermission = useCallback(async (): Promise<string> => {
    setIsPermissionLoading(true);

    try {
      if (!isAttSupported()) {
        return RESULTS.GRANTED;
      }

      const result = await check(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);
      const shouldEnableAnalytics = result === RESULTS.GRANTED;

      analytics.setAnalyticsEnabled(shouldEnableAnalytics);

      return result;
    } catch (error) {
      logger.error(
        "Analytics",
        "Error checking app tracking transparency",
        error,
      );

      analytics.setAnalyticsEnabled(false);

      return RESULTS.UNAVAILABLE;
    } finally {
      setIsPermissionLoading(false);
    }
  }, []);

  /**
   * Requests tracking permission from the user (one-time operation).
   *
   * ATT platforms: Shows system permission dialog and verifies result.
   * Non-ATT platforms: Returns GRANTED immediately.
   *
   * @returns Promise resolving to permission status
   */
  const requestTrackingPermission = useCallback(async (): Promise<string> => {
    setIsPermissionLoading(true);

    if (isAttRequested) {
      try {
        return await checkTrackingPermission();
      } finally {
        setIsPermissionLoading(false);
      }
    }

    if (!isAttSupported()) {
      try {
        return RESULTS.GRANTED;
      } finally {
        setIsPermissionLoading(false);
      }
    }

    try {
      const result = await request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);

      if (shouldMarkAttAsRequested(result)) {
        analytics.setAttRequested(true);
      }

      return await checkTrackingPermission();
    } catch (error) {
      logger.error(
        "Analytics",
        "Error requesting app tracking transparency",
        error,
      );

      return RESULTS.UNAVAILABLE;
    } finally {
      setIsPermissionLoading(false);
    }
  }, [isAttRequested, checkTrackingPermission]);

  /**
   * Opens device settings for permission management.
   */
  const handleOpenSettings = useCallback(async (): Promise<void> => {
    try {
      await openSettings();
    } catch (error) {
      logger.error("Analytics", "Error opening device settings", error);
    }
  }, []);

  /**
   * Handles analytics toggle with platform-specific behavior.
   *
   * ATT platforms: Shows guidance modal for device settings navigation.
   * Non-ATT platforms: Toggles analytics state directly.
   */
  const handleAnalyticsToggle = useCallback(async (): Promise<void> => {
    setIsPermissionLoading(true);

    try {
      if (!isAttSupported()) {
        const newAnalyticsState = !isEnabled;

        analytics.setAnalyticsEnabled(newAnalyticsState);

        return;
      }

      if (isEnabled) {
        setPermissionAction("disable");
        setShowPermissionModal(true);

        return;
      }

      const currentStatus = await checkTrackingPermission();

      if (currentStatus === RESULTS.GRANTED) {
        return;
      }

      if (currentStatus === RESULTS.BLOCKED) {
        setPermissionAction("enable");
        setShowPermissionModal(true);

        return;
      }

      if (currentStatus === RESULTS.UNAVAILABLE) {
        return;
      }

      if (!isAttRequested) {
        const requestResult = await requestTrackingPermission();

        if (requestResult === RESULTS.BLOCKED) {
          setPermissionAction("enable");
          setShowPermissionModal(true);
        }

        return;
      }

      setPermissionAction("enable");
      setShowPermissionModal(true);
    } catch (error) {
      logger.error("Analytics", "Error in handleAnalyticsToggle", error);
    } finally {
      setIsPermissionLoading(false);
    }
  }, [
    isEnabled,
    isAttRequested,
    checkTrackingPermission,
    requestTrackingPermission,
  ]);

  /**
   * Synchronizes permission state with device settings (ATT platforms only).
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!isAttSupported()) {
      return;
    }

    try {
      await checkTrackingPermission();
    } catch (error) {
      logger.error("Analytics", "Error syncing tracking permission", error);
    }
  }, [checkTrackingPermission]);

  const syncTrackingPermission = useDebounce(() => {
    performSync();
  }, SYNC_DEBOUNCE_DELAY);

  // Initialize analytics and set up app state monitoring
  useEffect(() => {
    const initializeAnalytics = async (): Promise<void> => {
      if (isAttSupported() && !isAttRequested) {
        await requestTrackingPermission();
      } else if (isAttSupported()) {
        await checkTrackingPermission();
      }

      initAnalytics();

      await analytics.identifyUser();

      analytics.trackAppOpened({ previousState });
    };

    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const prevState = appStateRef.current;

      if (nextAppState === "active" && !isInitialLaunchRef.current) {
        analytics.trackAppOpened({ previousState: prevState });

        if (isAttSupported()) {
          syncTrackingPermission();
        }
      }

      appStateRef.current = nextAppState;
      isInitialLaunchRef.current = false;
    };

    initializeAnalytics();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [
    isAttRequested,
    previousState,
    requestTrackingPermission,
    checkTrackingPermission,
    syncTrackingPermission,
  ]);

  return {
    isTrackingEnabled: isEnabled,
    isAttRequested,
    handleAnalyticsToggle,
    syncTrackingPermission,
    isPermissionLoading,
    showPermissionModal,
    setShowPermissionModal,
    handleOpenSettings,
    permissionAction,
  };
};
