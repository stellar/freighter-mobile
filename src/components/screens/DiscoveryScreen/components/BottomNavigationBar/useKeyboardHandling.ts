import { isAndroid, isIOS } from "helpers/device";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, TextInput } from "react-native";
import { SharedValue } from "react-native-reanimated";

interface UseKeyboardHandlingParams {
  isOwnKeyboard: SharedValue<boolean>;
  onFocusChange?: (focused: boolean) => void;
  onCancel: () => void;
  onInputChange: (text: string) => void;
}

/**
 * Custom hook encapsulating keyboard interaction logic for the URL bar:
 * focus/blur handlers, cursor positioning, Android hardware-back workaround,
 * and the clear button handler.
 */
const useKeyboardHandling = ({
  isOwnKeyboard,
  onFocusChange,
  onCancel,
  onInputChange,
}: UseKeyboardHandlingParams) => {
  const inputRef = useRef<TextInput>(null);

  // React state for the input value/alignment switch and Android overlay.
  // Visual transitions are driven by the keyboard progress SharedValue,
  // not by isFocused.
  const [isFocused, setIsFocused] = useState(false);

  const [cursorSelection, setCursorSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const handleInputFocus = useCallback(() => {
    isOwnKeyboard.value = true;
    setIsFocused(true);
    onFocusChange?.(true);

    // Move cursor to beginning of input on focus. iOS needs a frame
    // defer to avoid racing with the keyboard animation.
    const moveCursor = () => setCursorSelection({ start: 0, end: 0 });
    if (isIOS) {
      requestAnimationFrame(moveCursor);
    } else {
      moveCursor();
    }
  }, [isOwnKeyboard, onFocusChange]);

  // onCancel is called on blur so that every dismiss path (Cancel button,
  // tap outside, Android hardware back button) restores the URL.
  const handleInputBlur = useCallback(() => {
    isOwnKeyboard.value = false;
    setIsFocused(false);
    onFocusChange?.(false);
    onCancel();
  }, [isOwnKeyboard, onFocusChange, onCancel]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    // onCancel() will fire via handleInputBlur when the dismiss triggers blur.
  }, []);

  // On Android, the hardware back button dismisses the keyboard but does
  // NOT blur the TextInput. Listen for keyboard hide to trigger cancel.
  useEffect(() => {
    if (!isAndroid) return undefined;

    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (inputRef.current?.isFocused()) {
        inputRef.current.blur();
      }
    });

    return () => sub.remove();
  }, []);

  // Release controlled selection after native applies cursor position,
  // so the user can freely move the cursor afterward.
  const handleSelectionChange = useCallback(() => {
    if (cursorSelection) {
      setCursorSelection(undefined);
    }
  }, [cursorSelection]);

  const handleClear = useCallback(() => {
    onInputChange("");
  }, [onInputChange]);

  return {
    inputRef,
    isFocused,
    cursorSelection,
    handleInputFocus,
    handleInputBlur,
    handleCancel,
    handleSelectionChange,
    handleClear,
  };
};

export default useKeyboardHandling;
