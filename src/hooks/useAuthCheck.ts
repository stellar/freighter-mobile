import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  AppState,
  AppStateStatus,
  InteractionManager,
  PanResponder,
  PanResponderInstance,
} from "react-native";

const BACKGROUND_CHECK_INTERVAL = 60000; // Check every minute when app is in background
const FOREGROUND_CHECK_INTERVAL = 10000; // Check every 10 seconds when app is in foreground
const ACTIVE_CHECK_INTERVAL = 5000; // Check every 5 seconds when user is actively using the app

/**
 * Hook that periodically checks authentication status and redirects to lock screen when needed
 * Accelerates checks when the user is actively using the app
 */
const useAuthCheck = () => {
  const { getAuthStatus, authStatus, navigateToLockScreen } =
    useAuthenticationStore();
  const [isActive, setIsActive] = useState(true);
  const appState = useRef(AppState.currentState);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const lastCheckRef = useRef(Date.now());
  const panResponderRef = useRef<PanResponderInstance | null>(null);

  // Check auth status based on current state (background, foreground, active)
  const checkAuth = useCallback(async () => {
    try {
      const now = Date.now();
      // If it's been too soon since last check, skip
      if (now - lastCheckRef.current < 1000) {
        return;
      }

      // Don't perform auth checks too frequently while on lock screen
      if (authStatus === AUTH_STATUS.HASH_KEY_EXPIRED) {
        const skipChecksWhenExpired = true;
        if (skipChecksWhenExpired) {
          // Skip frequent checks when already in expired state
          return;
        }
      }

      lastCheckRef.current = now;
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

  // Set up interval for checking auth based on app state
  const setupCheckInterval = useCallback(
    (state: AppStateStatus) => {
      // Clear any existing interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      let intervalTime: number;

      // Determine check frequency based on app state
      if (state === "active") {
        if (isActive) {
          // User actively using the app
          intervalTime = ACTIVE_CHECK_INTERVAL;
        } else {
          // App in foreground but user not actively interacting
          intervalTime = FOREGROUND_CHECK_INTERVAL;
        }
      } else {
        // App in background
        intervalTime = BACKGROUND_CHECK_INTERVAL;
      }

      // Set up the interval
      checkIntervalRef.current = setInterval(() => {
        // Using a function that ignores the Promise
        checkAuth().catch((err) =>
          logger.error("setupCheckInterval", "Error checking auth", err),
        );
      }, intervalTime);
    },
    [isActive, checkAuth],
  );

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App has come to the foreground - check auth with a delay to allow app to fully resume
        setTimeout(() => {
          checkAuth().catch((err) =>
            logger.error("handleAppStateChange", "Error checking auth", err),
          );
        }, 300);
      }

      appState.current = nextAppState;
      setupCheckInterval(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Initial setup with a slight delay to ensure app is fully initialized
    setTimeout(() => {
      setupCheckInterval(appState.current);
    }, 300);

    return () => {
      subscription.remove();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [setupCheckInterval, checkAuth]);

  // Track user interaction
  useEffect(() => {
    const interactionStartListener =
      InteractionManager.createInteractionHandle();
    lastInteractionRef.current = Date.now();
    setIsActive(true);

    const interactionCheck = setInterval(() => {
      const now = Date.now();
      // If user hasn't interacted in 30 seconds, consider them "inactive"
      if (now - lastInteractionRef.current > 30000) {
        setIsActive(false);
      } else {
        setIsActive(true);
      }
    }, 5000);

    return () => {
      InteractionManager.clearInteractionHandle(interactionStartListener);
      clearInterval(interactionCheck);
    };
  }, []);

  // Initialize PanResponder to track user interactions
  useEffect(() => {
    const updateLastInteraction = () => {
      lastInteractionRef.current = Date.now();
      setIsActive(true);
    };

    // Create pan responder to detect touches
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

    // Check auth after a short delay to avoid race conditions with navigation
    const initialCheckTimeout = setTimeout(() => {
      checkAuth().catch((err) =>
        logger.error("initPanResponder", "Error checking auth", err),
      );
    }, 500);

    return () => {
      // Cleanup timeouts
      clearTimeout(initialCheckTimeout);
    };
  }, [checkAuth]);

  // Check auth on specific screens or after specific actions
  const checkAuthNow = useCallback(() => {
    checkAuth().catch((err) =>
      logger.error("checkAuthNow", "Error checking auth", err),
    );
  }, [checkAuth]);

  // Return the responder handlers along with other values
  return {
    checkAuthNow,
    isActive,
    authStatus,
    panHandlers: panResponderRef.current?.panHandlers,
  };
};

export default useAuthCheck;
