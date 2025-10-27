import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

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
 * Hook to manage polling based on screen focus
 * Automatically handles starting/stopping polling when screen is focused/unfocused
 *
 * @param params - Parameters for the polling
 * @param params.onStart - Function to call when polling should start
 * @param params.onStop - Function to call when polling should stop
 */
export const useFocusedPolling = ({
  onStart,
  onStop,
}: UseFocusedPollingParams) => {
  // Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      // Start polling when screen is focused
      onStart();

      // Stop polling when screen loses focus
      return () => {
        onStop();
      };
    }, [onStart, onStop]),
  );
};
