import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useEffect } from "react";

interface UseFocusedPollingParams {
  /**
   * Function to call for each poll
   */
  onPoll: () => void;
  /**
   * Polling interval in milliseconds
   */
  interval: number;
}

/**
 * Hook to manage polling based on screen focus
 *
 * Automatically handles starting/stopping polling when screen is focused/unfocused.
 * Tracks the last poll time and resets the timestamp if the specified interval has passed since
 * the last poll, triggering an immediate fetch before the polling timer starts.
 *
 * @param params - Parameters for the polling
 * @param params.onPoll - Function to call for each poll
 * @param params.interval - Polling interval in milliseconds
 */
export const useFocusedPolling = ({
  onPoll,
  interval,
}: UseFocusedPollingParams) => {
  const lastPollTimeRef = useRef<number>(0); // Start at 0 to ensure immediate fetch on first load
  const remainingTimeRef = useRef<number>(interval);
  const pauseTimeRef = useRef<number | null>(null);
  const pollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (pollingIntervalIdRef.current) {
      clearTimeout(pollingIntervalIdRef.current);
      clearInterval(pollingIntervalIdRef.current);
      pollingIntervalIdRef.current = null;
    }
  }, []);

  const handleUnmount = useCallback(() => {
    clearAllTimers();
  }, [clearAllTimers]);

  const handleUnfocus = useCallback(() => {
    clearAllTimers();
    const pauseTime = Date.now();
    pauseTimeRef.current = pauseTime;
  }, [clearAllTimers]);

  const startPolling = useCallback(
    (immediate = false) => {
      clearAllTimers();

      if (immediate) {
        onPoll();
        lastPollTimeRef.current = Date.now();
      }

      pollingIntervalIdRef.current = setInterval(() => {
        onPoll();
        lastPollTimeRef.current = Date.now();
      }, interval);
    },
    [onPoll, interval, clearAllTimers],
  );

  useEffect(() => handleUnmount, [handleUnmount]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTimeRef.current;

      clearAllTimers();

      if (timeSinceLastPoll >= interval) {
        remainingTimeRef.current = interval;
        startPolling(true);
      } else if (pauseTimeRef.current) {
        // Resume: subtract the paused duration from remaining time
        const pausedDuration = now - pauseTimeRef.current;
        remainingTimeRef.current = Math.max(
          0,
          remainingTimeRef.current - pausedDuration,
        );

        const shouldFetchImmediately = remainingTimeRef.current <= 0;

        pauseTimeRef.current = null;

        if (shouldFetchImmediately) {
          remainingTimeRef.current = interval;
          startPolling(true);
        } else {
          pollingIntervalIdRef.current = setTimeout(() => {
            remainingTimeRef.current = interval;

            // Do immediate fetch since the timer expired
            onPoll();
            lastPollTimeRef.current = Date.now();

            pollingIntervalIdRef.current = setInterval(() => {
              onPoll();
              lastPollTimeRef.current = Date.now();
            }, interval);
          }, remainingTimeRef.current);
        }
      } else {
        startPolling(false);
      }

      return handleUnfocus;
    }, [startPolling, interval, clearAllTimers, handleUnfocus, onPoll]),
  );
};
