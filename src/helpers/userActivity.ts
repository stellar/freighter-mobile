/**
 * Bridge for recording user activity from outside the AuthCheckProvider tree.
 *
 * The app-wide PanResponder can't see touches consumed by
 * react-native-gesture-handler or system-keyboard keystrokes. Components
 * handling those call `recordUserActivity()` to keep the foreground-idle clock
 * fresh; useAuthCheck registers the actual recorder so the source stays there.
 */
type ActivityRecorder = () => void;

let activityRecorder: ActivityRecorder | null = null;

/** Registered by useAuthCheck; pass null on unmount. */
export const setActivityRecorder = (
  recorder: ActivityRecorder | null,
): void => {
  activityRecorder = recorder;
};

/** Marks "now" as user activity, resetting the foreground-idle auto-lock clock. */
export const recordUserActivity = (): void => {
  activityRecorder?.();
};
