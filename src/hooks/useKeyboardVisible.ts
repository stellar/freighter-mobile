import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Hook to track keyboard visibility state
 * Uses platform-appropriate events to detect keyboard changes before animation starts:
 * - iOS: keyboardWillShow/keyboardWillHide (fires before animation)
 * - Android: keyboardDidShow/keyboardDidHide (Android doesn't have "Will" events)
 *
 * @returns boolean indicating whether the keyboard is currently visible
 * @example
 * const MyComponent = () => {
 *   const isKeyboardVisible = useKeyboardVisible();
 *
 *   return (
 *     <View style={{ paddingBottom: isKeyboardVisible ? 0 : 24 }}>
 *       <Text>Content</Text>
 *     </View>
 *   );
 * };
 */
export default function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Use 'Will' events on iOS for smoother transitions (fires before animation)
    // Use 'Did' events on Android (no 'Will' events available)
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  return isKeyboardVisible;
}
