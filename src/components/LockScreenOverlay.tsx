import { LockScreenContent } from "components/screens/LockScreen";
import { useAuthenticationStore } from "ducks/auth";
import useTheme from "hooks/useTheme";
import React, { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

const styles = StyleSheet.create({
  container: StyleSheet.absoluteFillObject,
});

/**
 * Full-screen overlay for the in-process soft lock (auto-lock timer or the
 * timer). Rendered after the navigation + bottom-sheet providers
 * so it covers them while the screens underneath keep their state for after
 * the unlock; unlocking clears isSoftLocked and unmounts it. Swallows the
 * Android back button and hides the tree from accessibility. Cold starts use
 * the LockScreen route instead.
 */
export const LockScreenOverlay: React.FC = () => {
  // Narrow selector: avoid re-rendering on unrelated auth-store churn
  const isSoftLocked = useAuthenticationStore((state) => state.isSoftLocked);
  const theme = useTheme();

  // Swallow the Android back button while locked so it can't pop the hidden
  // tree or exit the app
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
      style={[styles.container, { backgroundColor: theme.colors.base.primary }]}
      testID="lock-screen-overlay"
      accessibilityViewIsModal
    >
      <LockScreenContent />
    </View>
  );
};

export default LockScreenOverlay;
