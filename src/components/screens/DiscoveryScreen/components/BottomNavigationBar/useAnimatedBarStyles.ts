import {
  BAR_SPACING,
  BUTTON_SIZE,
  CANCEL_EXTRA_WIDTH,
  IOS_FOCUSED_BORDER_RADIUS,
  IOS_FOCUSED_MARGIN_BOTTOM,
  IOS_FOCUSED_MARGIN_HORIZONTAL,
  POINTER_EVENTS_THRESHOLD,
} from "components/screens/DiscoveryScreen/components/BottomNavigationBar/constants";
import { isIOS } from "helpers/device";
import { ViewStyle } from "react-native";
import { SharedValue, useAnimatedStyle } from "react-native-reanimated";

interface UseAnimatedBarStylesParams {
  isOwnKeyboard: SharedValue<boolean>;
  progress: SharedValue<number>;
  keyboardHeight: SharedValue<number>;
  tabBarHeight: number;
}

/**
 * Custom hook providing all keyboard-driven animated styles for the
 * BottomNavigationBar. Each style is driven by the keyboard progress
 * SharedValue (0 = closed, 1 = open) so transitions stay in sync
 * with the keyboard slide animation.
 */
const useAnimatedBarStyles = ({
  isOwnKeyboard,
  progress,
  keyboardHeight,
  tabBarHeight,
}: UseAnimatedBarStylesParams) => {
  // When the search bar owns the keyboard, slide up in sync.
  // When a WebView input opens the keyboard, fade out and disable touches.
  const slideStyle = useAnimatedStyle((): ViewStyle => {
    if (isOwnKeyboard.value) {
      const gap = isIOS ? IOS_FOCUSED_MARGIN_BOTTOM * progress.value : 0;
      const offset = Math.min(0, keyboardHeight.value + tabBarHeight - gap);
      return {
        transform: [{ translateY: offset }],
        opacity: 1,
        pointerEvents: "auto",
      };
    }
    // WebView keyboard — fade out
    return {
      transform: [{ translateY: 0 }],
      opacity: 1 - progress.value,
      pointerEvents:
        progress.value > POINTER_EVENTS_THRESHOLD ? "none" : "auto",
    };
  });

  // Elements visible when keyboard is closed (unfocused state).
  // Only transition when the search bar owns the keyboard.
  const unfocusedStyle = useAnimatedStyle((): ViewStyle => {
    const p = isOwnKeyboard.value ? progress.value : 0;
    return {
      opacity: 1 - p,
      pointerEvents: p < POINTER_EVENTS_THRESHOLD ? "auto" : "none",
    };
  });

  // Elements visible when keyboard is open (focused state).
  const focusedStyle = useAnimatedStyle((): ViewStyle => {
    const p = isOwnKeyboard.value ? progress.value : 0;
    return {
      opacity: p,
      pointerEvents: p > POINTER_EVENTS_THRESHOLD ? "auto" : "none",
    };
  });

  // On iOS, the bar gets rounded corners and side/bottom borders when
  // focused to match the iOS 26 keyboard style.
  const barContainerStyle = useAnimatedStyle((): ViewStyle => {
    if (!isIOS) return {};
    const p = isOwnKeyboard.value ? progress.value : 0;
    return {
      borderRadius: IOS_FOCUSED_BORDER_RADIUS * p,
      marginHorizontal: IOS_FOCUSED_MARGIN_HORIZONTAL * p,
      overflow: "hidden",
      borderLeftWidth: p,
      borderRightWidth: p,
      borderBottomWidth: p,
    };
  });

  // Search bar left margin: 16px when unfocused (space after avatar),
  // 0px when focused (avatar is gone).
  const searchBarStyle = useAnimatedStyle((): ViewStyle => {
    const p = isOwnKeyboard.value ? progress.value : 0;
    return { marginLeft: BAR_SPACING * (1 - p) };
  });

  // Right button container: 40px when unfocused (matches tab count),
  // expands to fit cancel label when focused. Keeps a left margin so
  // there's always spacing between the search bar and this button.
  const rightButtonStyle = useAnimatedStyle((): ViewStyle => {
    const p = isOwnKeyboard.value ? progress.value : 0;
    return {
      maxWidth: BUTTON_SIZE + CANCEL_EXTRA_WIDTH * p,
      overflow: "hidden",
      marginLeft: BAR_SPACING,
    };
  });

  // Avatar fades out and shrinks so the input can reclaim its space.
  const avatarStyle = useAnimatedStyle((): ViewStyle => {
    const p = isOwnKeyboard.value ? progress.value : 0;
    return {
      opacity: 1 - p,
      transform: [{ scale: 1 - p }],
      width: BUTTON_SIZE * (1 - p),
      pointerEvents: p < POINTER_EVENTS_THRESHOLD ? "auto" : "none",
    };
  });

  return {
    slideStyle,
    unfocusedStyle,
    focusedStyle,
    barContainerStyle,
    searchBarStyle,
    rightButtonStyle,
    avatarStyle,
  };
};

export default useAnimatedBarStyles;
