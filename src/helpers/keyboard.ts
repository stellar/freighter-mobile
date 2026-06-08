import { Keyboard } from "react-native";

/**
 * Resolves only after the keyboard has fully hidden, so a bottom sheet
 * presented next animates in at its final height instead of opening at the
 * keyboard-occluded position and visibly jumping down.
 *
 * Resolves immediately when the keyboard is already hidden (no-op path).
 */
export const waitForKeyboardDismiss = (): Promise<void> => {
  if (!Keyboard.isVisible()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      sub.remove();
      resolve();
    });
    Keyboard.dismiss();
  });
};
