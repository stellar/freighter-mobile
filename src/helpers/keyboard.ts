import { isAndroid } from "helpers/device";
import { Keyboard } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

/**
 * Resolves only after the keyboard has fully hidden, so a bottom sheet
 * presented next animates in at its final height instead of opening at the
 * keyboard-occluded position and visibly jumping down, and a screen pushed
 * next doesn't slide in while the keyboard is still sliding away.
 *
 * Resolves immediately when the keyboard is already hidden (no-op path).
 *
 * On Android it waits on react-native-keyboard-controller instead: React
 * Native's own keyboardDidHide fires there as the keyboard starts sliding
 * away, while keyboard-controller's fires when the slide has ended.
 */
export const waitForKeyboardDismiss = (): Promise<void> => {
  if (isAndroid) {
    return KeyboardController.dismiss();
  }

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
