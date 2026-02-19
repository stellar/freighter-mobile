import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  AppState,
  AppStateStatus,
  PanResponder,
  PanResponderInstance,
} from "react-native";

// Constants for interval timings (in milliseconds)
const BACKGROUND_CHECK_INTERVAL = 60000; // Check every minute when in background
const FOREGROUND_CHECK_INTERVAL = 10000; // Check every 10 seconds in foreground (inactive)
const ACTIVE_CHECK_INTERVAL = 5000; // Check every 5 seconds when user is active
const MIN_CHECK_INTERVAL = 1000; // Minimum interval between auth checks
const INACTIVITY_THRESHOLD = 30000; // User is inactive after 30 seconds without interaction
const INTERACTION_CHECK_INTERVAL = 5000; // Frequency to check for user interaction
const INITIAL_CHECK_DELAY = 300; // Delay before performing an initial auth check
const INITIAL_SETUP_DELAY = 500; // Delay to prevent race conditions during setup

/**
 * Custom hook to periodically check authentication status and redirect to the lock screen if needed.
 * It adjusts the check frequency based on the app state and user activity.
 */
const useAuthCheck = () => {
  const { getAuthStatus, authStatus, navigateToLockScreen } =
    useAuthenticationStore();
  const [isActive, setIsActive] = useState(true);

  // Refs to track app state, last interaction, auth check intervals, and pan responder instance
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const lastCheckRef = useRef<number>(Date.now());
  const panResponderRef = useRef<PanResponderInstance | null>(null);

  /**
   * Check the authentication status and navigate to the lock screen if the auth hash is expired.
   */
  const checkAuth = useCallback(async () => {
    const now = Date.now();

    // Prevent excessive checking
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL) return;
    // Skip checks if already on lock screen or in locked state
    if (
      authStatus === AUTH_STATUS.HASH_KEY_EXPIRED ||
      authStatus === AUTH_STATUS.LOCKED
    )
      return;

    lastCheckRef.current = now;
    try {
      const status = await getAuthStatus();
      if (status === AUTH_STATUS.HASH_KEY_EXPIRED) {
        navigateToLockScreen();
      }
    } catch (error) {
      logger.error(
        "useAuthCheck.checkAuth",
        "Failed to check auth status",
        error,
      );
    }
  }, [getAuthStatus, navigateToLockScreen, authStatus]);

  /**
   * Setup a periodic interval to check authentication status based on the current app state and user activity.
   */
  const setupCheckInterval = useCallback(
    (state: AppStateStatus) => {
      // Clear any existing interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      let intervalTime: number;
      if (state === "active") {
        intervalTime = isActive
          ? ACTIVE_CHECK_INTERVAL
          : FOREGROUND_CHECK_INTERVAL;
      } else {
        intervalTime = BACKGROUND_CHECK_INTERVAL;
      }

      checkIntervalRef.current = setInterval(() => {
        checkAuth().catch((err) =>
          logger.error("setupCheckInterval", "Error checking auth", err),
        );
      }, intervalTime);
    },
    [isActive, checkAuth],
  );

  /**
   * Listen for app state changes (foreground/background) to adjust the auth check interval.
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // When returning to active state, allow a slight delay before checking auth
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        setTimeout(() => {
          checkAuth().catch((err) =>
            logger.error("handleAppStateChange", "Error checking auth", err),
          );
        }, INITIAL_CHECK_DELAY);
      }
      appState.current = nextAppState;
      setupCheckInterval(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Initial setup delay to ensure the app is fully initialized
    setTimeout(() => {
      setupCheckInterval(appState.current);
    }, INITIAL_CHECK_DELAY);

    return () => {
      subscription.remove();
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [setupCheckInterval, checkAuth]);

  /**
   * Monitor user interaction and update active status accordingly.
   */
  useEffect(() => {
    lastInteractionRef.current = Date.now();
    setIsActive(true);

    const interactionChecker = setInterval(() => {
      const now = Date.now();
      setIsActive(now - lastInteractionRef.current <= INACTIVITY_THRESHOLD);
    }, INTERACTION_CHECK_INTERVAL);

    return () => clearInterval(interactionChecker);
  }, []);

  /**
   * Initialize PanResponder to capture touch interactions and update the last interaction timestamp.
   */
  useEffect(() => {
    const updateLastInteraction = () => {
      lastInteractionRef.current = Date.now();
      setIsActive(true);
    };

    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => {
        updateLastInteraction();
        return false;
      },
      onMoveShouldSetPanResponder: () => {
        updateLastInteraction();
        return false;
      },
      onPanResponderTerminationRequest: () => true,
    });

    // Perform an initial auth check after a short delay to avoid navigation race conditions
    const initialCheckTimeout = setTimeout(() => {
      checkAuth().catch((err) =>
        logger.error("initPanResponder", "Error checking auth", err),
      );
    }, INITIAL_SETUP_DELAY);

    return () => clearTimeout(initialCheckTimeout);
  }, [checkAuth]);

  /**
   * Provide a function to manually trigger an auth check.
   */
  const checkAuthNow = useCallback(() => {
    checkAuth().catch((err) =>
      logger.error("checkAuthNow", "Error checking auth", err),
    );
  }, [checkAuth]);

  return {
    checkAuthNow,
    isActive,
    authStatus,
    panHandlers: panResponderRef.current?.panHandlers,
  };
};

export default useAuthCheck;
