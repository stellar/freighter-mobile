import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS "Reduce Motion" setting is on. Follows `reduceMotionChanged`,
 * so flipping it mid-session is honoured without a restart.
 *
 * Starts `true` — motion reduced — because the OS value settles
 * asynchronously, and that window is one where an animation could still run
 * for a user who asked for none. The cost the other way is at most one
 * skipped morph. When it reports true an animation must not run at all, not
 * merely run cheaper.
 */
const useIsReduceMotionEnabled = (): boolean => {
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    /**
     * Whether the OS has told us directly. The initial query and the change
     * listener race: the query reads the value at mount but settles later, so
     * if the setting flips in that window the listener commits the new value
     * and the query then overwrites it with the one it read before. The user
     * asked for motion to stop and it keeps running. Once an event has
     * arrived it is by definition newer than the query, so the query defers.
     */
    let hasHeardFromListener = false;

    const applyFromListener = (enabled: boolean) => {
      if (!isSubscribed) {
        return;
      }

      hasHeardFromListener = true;
      setIsReduceMotionEnabled(enabled);
    };

    const applyFromInitialQuery = (enabled: boolean) => {
      if (!isSubscribed || hasHeardFromListener) {
        return;
      }

      setIsReduceMotionEnabled(enabled);
    };

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      applyFromListener,
    );

    // Issued AFTER the subscription is live. The query is a native round
    // trip: dispatching it first leaves a window where the setting can flip
    // with no listener registered to hear it, so the event is never
    // delivered, `hasHeardFromListener` stays false, and the stale value the
    // query read is committed for the whole session.
    AccessibilityInfo.isReduceMotionEnabled()
      .then(applyFromInitialQuery)
      // A platform that cannot answer must not leave motion switched off for
      // the session: fall back to the OS default of motion allowed. Still
      // deferring to the listener — a failed read is not newer than an event.
      .catch(() => applyFromInitialQuery(false));

    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  }, []);

  return isReduceMotionEnabled;
};

export default useIsReduceMotionEnabled;
