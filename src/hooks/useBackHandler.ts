import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";

/**
 * Handles Android's hardware back button while `enabled` is true.
 *
 * `onBack` returns true once it has handled the press, which stops it there,
 * or false to pass it on. Android runs the newest listener first, so the
 * listener is registered once per enable and always calls the latest
 * `onBack`. Registering again on every render would jump it ahead of
 * listeners added since, such as the lock overlay's.
 *
 * Known issue, expected on React Native 0.81 with targetSdk 36: once a Back
 * press that no listener handled has sent the app to the background, Back
 * stops reaching JavaScript until the app restarts. These listeners then
 * never run, and Back keeps closing the app. React Native turns its own back
 * callback off before handing Back to Android and never turns it on again.
 * Fixed upstream from React Native 0.84, so upgrade to 0.84 or later and
 * re-test: https://github.com/facebook/react-native/issues/54887
 */
const useBackHandler = (onBack: () => boolean, enabled = true): void => {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
      onBackRef.current(),
    );

    return () => subscription.remove();
  }, [enabled]);
};

export default useBackHandler;
