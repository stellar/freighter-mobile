import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LockScreenContent } from "components/screens/LockScreen";
import { useAuthenticationStore } from "ducks/auth";
import useBackHandler from "hooks/useBackHandler";
import useTheme from "hooks/useTheme";
import React from "react";
import { StyleSheet, View } from "react-native";

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
  useBackHandler(() => true, isSoftLocked);

  if (!isSoftLocked) {
    return null;
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.base.primary }]}
      testID="lock-screen-overlay"
      accessibilityViewIsModal
    >
      {/* The app's sheets render under this overlay, so the lock screen's own
          (the forgot-password warning) needs a provider of its own to show
          above it. */}
      <BottomSheetModalProvider>
        <LockScreenContent />
      </BottomSheetModalProvider>
    </View>
  );
};

export default LockScreenOverlay;
