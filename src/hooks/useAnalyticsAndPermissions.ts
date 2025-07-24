import { logger } from "config/logger";
import { useAnalyticsStore } from "ducks/analytics";
import { useEffect, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { PERMISSIONS, RESULTS, request } from "react-native-permissions";
import { analytics } from "services/analytics";
import { initAnalytics } from "services/analytics/core";

interface UseAnalyticsAndPermissionsParams {
  previousState?: string;
}

const shouldSetAttRequested = (result: string) =>
  result === RESULTS.GRANTED ||
  result === RESULTS.DENIED ||
  result === RESULTS.BLOCKED;

export const useAnalyticsAndPermissions = ({
  previousState = "none",
}: UseAnalyticsAndPermissionsParams = {}) => {
  const attRequested = useAnalyticsStore((state) => state.attRequested);
  const setAttRequested = useAnalyticsStore((state) => state.setAttRequested);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isFirstLaunchRef = useRef(true);

  useEffect(() => {
    const handleInit = async () => {
      // Request App Tracking Transparency permission (iOS only, and only once)
      if (Platform.OS === "ios" && !attRequested) {
        try {
          const result = await request(
            PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY,
          );
          analytics.setAnalyticsEnabled(result === RESULTS.GRANTED);

          // Only set attRequested if the user interacted with the permission dialog
          if (shouldSetAttRequested(result)) {
            setAttRequested(true);
          }
        } catch (error) {
          logger.error(
            "App",
            "Error requesting app tracking transparency",
            error,
          );
        }
      }
      initAnalytics();
      await analytics.identifyUser();

      // Track app opened event (cold boot)
      analytics.trackAppOpened({ previousState });
    };

    handleInit();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;

      if (nextAppState === "active" && !isFirstLaunchRef.current) {
        analytics.trackAppOpened({ previousState: prevState });

        /* fallback in case the handle init fails
         * reasons:
         * - app booted before the handle init was completed
         * - splash screen is not hidden yet (app is not ready to track events)
         */
        if (Platform.OS === "ios" && !attRequested) {
          request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY)
            .then((result) => {
              analytics.setAnalyticsEnabled(result === RESULTS.GRANTED);

              // Only set attRequested if the user interacted with the permission dialog
              if (shouldSetAttRequested(result)) {
                setAttRequested(true);
              }
            })
            .catch((error) => {
              logger.error(
                "App",
                "Error requesting app tracking transparency",
                error,
              );
            });
        }
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
  }, [attRequested, setAttRequested, previousState]);
};
