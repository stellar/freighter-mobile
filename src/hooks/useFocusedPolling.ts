import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

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

const POLLING_INTERVAL = 60000; // 60 seconds

/**
 * Hook to manage polling based on screen focus
 *
 * Automatically handles starting/stopping polling when screen is focused/unfocused.
 * Tracks the last poll time and resets the timestamp if 60 seconds have passed since
 * the last poll, triggering an immediate fetch before the polling timer starts.
 *
 * @param params - Parameters for the polling
 * @param params.onStart - Function to call when polling should start
 * @param params.onStop - Function to call when polling should stop
 */
export const useFocusedPolling = ({
  onStart,
  onStop,
}: UseFocusedPollingParams) => {
  const lastPollTimeRef = useRef<number>(Date.now());

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTimeRef.current;

      if (timeSinceLastPoll >= POLLING_INTERVAL) {
        lastPollTimeRef.current = now;
      }

      onStart();

      return () => {
        onStop();
      };
    }, [onStart, onStop]),
  );
};
