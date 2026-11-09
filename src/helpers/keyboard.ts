import { isAndroid } from "helpers/device";
import { Keyboard } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

/**
 * Settles with `promise`, or resolves once `timeoutMs` has passed, whichever
 * comes first. The timer is cleared when `promise` settles first.
 *
 * @param promise - The wait to cap
 * @param timeoutMs - The cap, in milliseconds
 * @returns A promise that settles once, on the first of the two
 */
const capWait = (promise: Promise<void>, timeoutMs: number): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, timeoutMs);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

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
 *
 * Without `timeoutMs` it waits for the hide however long it takes. With it,
 * it also resolves once `timeoutMs` has passed without the hide, for a caller
 * that must not be left waiting if the event never comes. It resolves once,
 * and on either path it removes its listener and clears its timer, so a late
 * hide event runs nothing.
 *
 * @param timeoutMs - Optional cap on the wait, in milliseconds
 * @returns A promise that resolves once the keyboard has hidden, or once
 * `timeoutMs` has passed
 */
export const waitForKeyboardDismiss = (timeoutMs?: number): Promise<void> => {
  if (isAndroid) {
    const dismissed = KeyboardController.dismiss();
    return timeoutMs === undefined ? dismissed : capWait(dismissed, timeoutMs);
  }

  if (!Keyboard.isVisible()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      clearTimeout(timer);
      sub.remove();
      resolve();
    });
    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        sub.remove();
        resolve();
      }, timeoutMs);
    }
    Keyboard.dismiss();
  });
};
