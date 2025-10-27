import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

interface UseFocusedPollingParams {
  /**
   * Callback function to execute when polling should start
   */
  onStart: () => void;
  /**
   * Callback function to execute when polling should stop
   */
  onStop: () => void;
}

/**
 * Hook to manage polling based on screen focus and app state
 * Automatically handles starting/stopping polling based on:
 * - Screen focus (when user navigates to/from screen)
 * - App state (when app goes to background/foreground)
 *
 * @param params - Parameters for the polling
 * @param params.onStart - Function to call when polling should start
 * @param params.onStop - Function to call when polling should stop
 */
export const useFocusedPolling = ({
  onStart,
  onStop,
}: UseFocusedPollingParams) => {
  const isScreenFocusedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;

      // Stop polling when app goes to background
      if (nextAppState === "background" || nextAppState === "inactive") {
        onStop();
      }
      // Resume polling when app becomes active and screen is focused
      else if (nextAppState === "active" && isScreenFocusedRef.current) {
        onStart();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [onStart, onStop]);

  // Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      // Start polling when screen is focused and app is active
      if (appStateRef.current === "active") {
        onStart();
      }

      return () => {
        isScreenFocusedRef.current = false;
        onStop();
      };
    }, [onStart, onStop]),
  );
};
