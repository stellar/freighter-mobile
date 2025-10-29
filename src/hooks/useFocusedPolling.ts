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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
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

  const startPollingInterval = useCallback(() => {
    intervalIdRef.current = setInterval(() => {
      onPoll();
      lastPollTimeRef.current = Date.now();
    }, interval);
  }, [onPoll, interval]);

  const startPolling = useCallback(
    (immediate = false) => {
      clearAllTimers();

      if (immediate) {
        onPoll();
        lastPollTimeRef.current = Date.now();
      }

      startPollingInterval();
    },
    [onPoll, clearAllTimers, startPollingInterval],
  );

  const restartPollingInterval = useCallback(() => {
    timeoutIdRef.current = null;
    remainingTimeRef.current = interval;

    // Do immediate fetch since the timer expired
    onPoll();
    lastPollTimeRef.current = Date.now();

    startPollingInterval();
  }, [onPoll, interval, startPollingInterval]);

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
          // Use setTimeout to wait for remaining time, then fetch instantly and restart interval.
          // Needed for pause/resume: when screen refocuses with time remaining (e.g., 5s),
          // we wait for that remaining time, fetch immediately, then restart the full interval.
          // setInterval can't be used here because it waits for the full interval before first fetch.
          timeoutIdRef.current = setTimeout(
            restartPollingInterval,
            remainingTimeRef.current,
          );
        }
      } else {
        startPolling(false);
      }

      return handleUnfocus;
    }, [
      startPolling,
      interval,
      clearAllTimers,
      handleUnfocus,
      restartPollingInterval,
    ]),
  );
};
