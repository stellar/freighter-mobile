import { navigationRef } from "components/App";
import { AUTO_LOCK_TIMER, AUTO_LOCK_TIMER_MS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import {
  hidePrivacyShield,
  markPrivacyShieldVisible,
} from "helpers/privacyShield";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { AppState, AppStateStatus, PanResponder } from "react-native";
import {
  getAutoLockTimer,
  // TODO/FIXME: dev-only override — remove before production
  getDevAutoLockTimerMs,
  hasPersistedSession,
  recordBackgroundedAt,
  // TODO/FIXME: dev-only idle-countdown readout — remove before production
  recordDevInteraction,
} from "services/autoLock";

// Delay before lifting the native privacy shield on foreground, giving a
// soft-lock overlay a frame to paint so the unlocked wallet never flashes
const SHIELD_REVEAL_DELAY = 50;

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
  const { getAuthStatus, authStatus } = useAuthenticationStore();
  const [isActive, setIsActive] = useState(true);

  // Refs to track app state, last interaction, and auth check intervals
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const lastCheckRef = useRef<number>(Date.now());

  /**
   * Mark "now" as the last user interaction. Called from every activity
   * signal (touches, navigation, unlock) so the foreground-idle timer only
   * fires after a genuinely idle stretch.
   */
  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setIsActive(true);
    // TODO/FIXME: dev-only — feeds the on-screen idle countdown readout
    recordDevInteraction();
  }, []);

  /**
   * PanResponder to observe touch interactions. Built during render (not in an
   * effect) so panHandlers are attached to the provider's View on the very
   * first render — otherwise touches wouldn't reset the idle clock until some
   * unrelated re-render populated the handlers, letting a freshly active user
   * be idle-locked from a stale timestamp. The *Capture variants run in the
   * capture phase (root → target) so the root sees EVERY touch start/move,
   * including taps on buttons/list items that would otherwise claim the
   * responder first; returning false observes without stealing the gesture.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          recordInteraction();
          return false;
        },
        onMoveShouldSetPanResponderCapture: () => {
          recordInteraction();
          return false;
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [recordInteraction],
  );

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
      // The store action is the single funnel for lock transitions: it
      // soft-locks atomically when the background auto-lock timer fired
      // (preserving the mounted screens under the overlay) and navigates to
      // the lock screen when the hash key hard-expired.
      const status = await getAuthStatus();

      // Foreground-idle auto-lock: while the app is active, lock after the
      // configured duration with no user interaction (touches reset
      // lastInteractionRef via the app-wide PanResponder). Background time is
      // handled by getAuthStatus above; here we cover an open-but-idle
      // session. Only timed presets idle-lock — IMMEDIATELY (0, background-
      // only) and NONE (null) are skipped.
      if (
        status === AUTH_STATUS.AUTHENTICATED &&
        AppState.currentState === "active"
      ) {
        const devAutoLockTimerMs = await getDevAutoLockTimerMs();
        const autoLockTimer = await getAutoLockTimer();
        const timerMs = devAutoLockTimerMs ?? AUTO_LOCK_TIMER_MS[autoLockTimer];

        if (
          timerMs !== null &&
          timerMs > 0 &&
          Date.now() - lastInteractionRef.current >= timerMs
        ) {
          // The user stayed in the app and idled out — suppress the lock
          // screen's biometric auto-prompt for this case.
          await useAuthenticationStore
            .getState()
            .softLock({ suppressBiometricPrompt: true });
        }
      }
    } catch (error) {
      logger.error(
        "useAuthCheck.checkAuth",
        "Failed to check auth status",
        error,
      );
    }
  }, [getAuthStatus, authStatus]);

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
      // Mirror the native shield: it's raised whenever the app backgrounds, so
      // the lock screen can hold its biometric prompt until the shield drops.
      if (nextAppState === "background") {
        markPrivacyShieldVisible();
      }

      // Record when the app goes to the background so the auto-lock timer can
      // be evaluated on the next foreground or cold start. Intentionally NOT
      // on "inactive": iOS fires it for control center, app-switcher peeks,
      // permission dialogs and biometric prompts. NOTE: some Android OEMs
      // emit "background" when their BiometricPrompt appears — worth keeping
      // in mind if IMMEDIATELY ever misbehaves around in-app biometric
      // confirmations on specific devices.
      const { authStatus: currentAuthStatus, softLock } =
        useAuthenticationStore.getState();
      if (nextAppState === "background") {
        // Gate on persisted session data, not only the zustand status: a cold
        // launch into an existing session can be backgrounded before
        // RootNavigator's async getAuthStatus sets AUTHENTICATED (the store is
        // still on its initial NOT_AUTHENTICATED). Treat that unhydrated window
        // as authenticated when a session exists on disk so the timestamp /
        // IMMEDIATELY lock still fire. A hydrated LOCKED / HASH_KEY_EXPIRED
        // status is respected (we don't re-record for an already-locked app).
        (async () => {
          const isSessionActive =
            currentAuthStatus === AUTH_STATUS.AUTHENTICATED ||
            (currentAuthStatus === AUTH_STATUS.NOT_AUTHENTICATED &&
              (await hasPersistedSession()));

          if (!isSessionActive) {
            return;
          }

          await recordBackgroundedAt();

          // Read from the secure-storage mirror (not the zustand store) so the
          // IMMEDIATELY lock also fires when backgrounding happens before
          // zustand rehydration completes.
          // TODO/FIXME: getDevAutoLockTimerMs is a dev-only override — when set
          // it must win over the IMMEDIATELY preset (exclusive), so the timed
          // dev countdown in getAuthStatus governs instead of an instant lock.
          const [devAutoLockTimerMs, autoLockTimer] = await Promise.all([
            getDevAutoLockTimerMs(),
            getAutoLockTimer(),
          ]);

          if (
            devAutoLockTimerMs === null &&
            autoLockTimer === AUTO_LOCK_TIMER.IMMEDIATELY
          ) {
            // Soft-lock right away: the overlay renders while the app is
            // backgrounded (no wallet content flashes on return) and the
            // navigation tree is preserved for after the unlock.
            await softLock();
          }
        })().catch((err) =>
          logger.error(
            "handleAppStateChange",
            "Error handling background auto-lock",
            err,
          ),
        );
      }

      // When returning to active state, resolve the auto-lock decision and
      // then dismiss the native privacy shield. Running getAuthStatus right
      // away (instead of only the delayed check below) lets a soft-lock
      // overlay mount before the shield lifts, so the unlocked wallet never
      // flashes; the brief delay gives that overlay a frame to paint.
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        useAuthenticationStore
          .getState()
          .getAuthStatus()
          .catch((err) =>
            logger.error(
              "handleAppStateChange",
              "Error checking auth on foreground",
              err,
            ),
          )
          .finally(() => {
            setTimeout(() => {
              // If the user re-backgrounded before this resolved, the native
              // side has re-shown the shield for the new background period —
              // don't lift it, or the next resume would briefly reveal the
              // unlocked tree while the lock decision runs.
              if (AppState.currentState === "active") {
                hidePrivacyShield();
              }
            }, SHIELD_REVEAL_DELAY);
          });

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
   * Reset the idle clock whenever the wallet becomes unlocked. The user is
   * actively present at unlock, but the lock screen / overlay sits outside
   * this provider's PanResponder, so its touches don't update
   * lastInteractionRef — without this the idle timer would still hold its
   * pre-lock (often already-elapsed) value and immediately re-lock.
   */
  useEffect(() => {
    if (authStatus === AUTH_STATUS.AUTHENTICATED) {
      recordInteraction();
    }
  }, [authStatus, recordInteraction]);

  /**
   * Treat navigation as user activity. Some controls (gesture-handler-based
   * buttons, swipeables, bottom sheets) bypass the JS responder system and
   * never reach the PanResponder below, so a route change is often the only
   * reliable signal that the user acted — without this a user could move
   * through several screens and still be idle-locked mid-flow.
   */
  useEffect(() => {
    const unsubscribe = navigationRef.addListener("state", recordInteraction);
    return unsubscribe;
  }, [recordInteraction]);

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
   * Perform an initial auth check after a short delay to avoid navigation race
   * conditions during setup.
   */
  useEffect(() => {
    const initialCheckTimeout = setTimeout(() => {
      checkAuth().catch((err) =>
        logger.error("initialCheck", "Error checking auth", err),
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
    panHandlers: panResponder.panHandlers,
  };
};

export default useAuthCheck;
