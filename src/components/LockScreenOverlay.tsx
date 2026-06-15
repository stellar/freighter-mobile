import { LockScreenContent } from "components/screens/LockScreen";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import React, { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.colors.background.default,
  },
});

/**
 * Full-screen overlay shown when the wallet is soft-locked in-process
 * (auto-lock timer or the IMMEDIATELY option firing on backgrounding).
 *
 * Rendered as a sibling AFTER the navigation container and the bottom sheet
 * provider so it covers them — while the mounted screens underneath keep
 * their navigation history, params and in-progress inputs for after the
 * unlock. The Android hardware back button is swallowed while locked, and
 * accessibility focus is confined to the overlay. Cold starts use the
 * regular LockScreen route instead (process state is gone anyway).
 * Unlocking flips isSoftLocked which unmounts the overlay, resuming the
 * user exactly where they were.
 */
export const LockScreenOverlay: React.FC = () => {
  // Narrow selector: this component sits at the app root and must not
  // re-render on unrelated auth-store churn (e.g. periodic status checks)
  const isSoftLocked = useAuthenticationStore((state) => state.isSoftLocked);

  // Swallow the Android hardware back button while locked: back presses must
  // not pop screens in the hidden tree underneath or exit the app
  useEffect(() => {
    if (!isSoftLocked) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );

    return () => subscription.remove();
  }, [isSoftLocked]);

  if (!isSoftLocked) {
    return null;
  }

  return (
    <View
      style={styles.container}
      testID="lock-screen-overlay"
      accessibilityViewIsModal
    >
      <LockScreenContent />
    </View>
  );
};

export default LockScreenOverlay;
