import { isAndroid, isIOS } from "helpers/device";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, TextInput } from "react-native";
import { SharedValue } from "react-native-reanimated";

const BLOCK_FOCUS_TIMEOUT_MS = 300;

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

  // Temporary guard used on Android to reject a single spurious focus event
  // caused by the OS auto-focusing the search bar when the WebView unmounts
  // during back-navigation to the homepage.
  const blockNextFocusRef = useRef(false);

  const handleInputFocus = useCallback(() => {
    if (isAndroid && blockNextFocusRef.current) {
      blockNextFocusRef.current = false;
      inputRef.current?.blur();
      return;
    }

    // eslint-disable-next-line no-param-reassign
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
    // eslint-disable-next-line no-param-reassign
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

  // Arms the focus guard so the next spurious focus event is rejected.
  // Automatically disarms after BLOCK_FOCUS_TIMEOUT_MS in case no focus event arrives.
  const blockFocusTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const blockNextFocus = useCallback(() => {
    blockNextFocusRef.current = true;
    clearTimeout(blockFocusTimeoutRef.current);
    blockFocusTimeoutRef.current = setTimeout(() => {
      blockNextFocusRef.current = false;
    }, BLOCK_FOCUS_TIMEOUT_MS);
  }, []);

  return {
    inputRef,
    isFocused,
    cursorSelection,
    handleInputFocus,
    handleInputBlur,
    handleCancel,
    handleSelectionChange,
    handleClear,
    blockNextFocus,
  };
};

export default useKeyboardHandling;
