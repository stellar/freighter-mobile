import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { StyledTextInput } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isAndroid, isIOS } from "helpers/device";
import { getDisplayHost } from "helpers/protocols";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, TextInput, View, ViewStyle, TouchableOpacity } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

/** Size of the avatar and tab count button */
const BUTTON_SIZE = 40;
/** Height of the search bar input area */
const INPUT_HEIGHT = 40;
/** Size of icons inside the search bar */
const ICON_SIZE = 20;
/** Spacing between bar children (avatar, search bar, right button) */
const BAR_SPACING = 16;
/** Max extra width the right button container gains when showing cancel */
const CANCEL_EXTRA_WIDTH = 60;
/** Bottom margin of the bar container when fully focused on iOS */
const IOS_FOCUSED_MARGIN_BOTTOM = 10;
/** Horizontal margin of the bar container when fully focused on iOS */
const IOS_FOCUSED_MARGIN_HORIZONTAL = 6;
/** Border radius of the bar container when fully focused on iOS */
const IOS_FOCUSED_BORDER_RADIUS = 20;
/**
 * Keyboard progress threshold at which pointer events swap between
 * focused and unfocused UI elements. At 50% progress the elements are
 * equally transparent, so this is the natural switch point.
 */
const POINTER_EVENTS_THRESHOLD = 0.5;

interface BottomNavigationBarProps {
  inputUrl: string;
  onInputChange: (text: string) => void;
  onUrlSubmit: () => void;
  onShowTabs: () => void;
  onCancel: () => void;
  onAvatarPress: () => void;
  tabsCount: number;
  canGoBack: boolean;
  onGoBack: () => void;
  contextMenuActions: MenuItem[];
  isHomePage: boolean;
  onFocusChange?: (focused: boolean) => void;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = React.memo(
  ({
    inputUrl,
    onInputChange,
    onUrlSubmit,
    onShowTabs,
    onCancel,
    onAvatarPress,
    tabsCount,
    canGoBack,
    onGoBack,
    contextMenuActions,
    isHomePage,
    onFocusChange,
  }) => {
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();
    const { t } = useAppTranslation();
    const tabBarHeight = useBottomTabBarHeight();
    const { height: keyboardHeight, progress } =
      useReanimatedKeyboardAnimation();
    const inputRef = useRef<TextInput>(null);
    // React state for the input value/alignment switch and Android overlay.
    // Visual transitions (avatar, icons, buttons, corners) are driven by
    // the keyboard progress SharedValue so they animate in sync with the
    // keyboard slide — isFocused is NOT used for those.
    const [isFocused, setIsFocused] = useState(false);
    // Tracks whether the search bar (not a WebView input) triggered the
    // keyboard. Used in worklets to decide between slide-up (own keyboard)
    // and fade-out (WebView keyboard) behavior.
    const isOwnKeyboard = useSharedValue(false);
    const [cursorSelection, setCursorSelection] = useState<
      { start: number; end: number } | undefined
    >(undefined);

    const displayUrl = useMemo(() => {
      if (!inputUrl) return "";
      const host = getDisplayHost(inputUrl);
      if (!host) return inputUrl;
      return host.replace(/^www\./, "");
    }, [inputUrl]);

    // -- Animated styles driven by keyboard progress (0 = closed, 1 = open) --

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

    return (
      <Animated.View style={slideStyle}>
        <Animated.View
          style={barContainerStyle}
          className="flex-row items-center bg-background-primary border-t border-border-primary px-6 py-4"
        >
          {/* Avatar — fades out and shrinks during keyboard open */}
          <Animated.View style={avatarStyle}>
            <TouchableOpacity
              onPress={onAvatarPress}
              accessibilityRole="button"
              accessibilityLabel={t("discovery.switchAccount")}
            >
              <Avatar size="lg" publicAddress={account?.publicKey ?? ""} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[searchBarStyle, { height: INPUT_HEIGHT }]}
            className="flex-1 flex-row items-center rounded-lg bg-background-tertiary px-3 gap-2"
          >
            {/* Left icon area — cross-fade between search icon and back button */}
            <View
              style={{ width: ICON_SIZE, height: INPUT_HEIGHT }}
              className="items-center justify-center"
            >
              <Animated.View style={focusedStyle}>
                <Icon.SearchMd
                  size={ICON_SIZE}
                  color={themeColors.text.secondary}
                />
              </Animated.View>
              {canGoBack && (
                <Animated.View
                  style={[unfocusedStyle, { position: "absolute" as const }]}
                >
                  <TouchableOpacity
                    onPress={onGoBack}
                    disabled={!canGoBack}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("discovery.goBack")}
                  >
                    <Icon.ChevronLeft
                      size={ICON_SIZE}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {/* URL input area. The TextInput value and alignment switch via
               isFocused (full URL left-aligned when focused, display URL
               centered when unfocused). On Android, an additional Text overlay
               handles ellipsis since TextInput doesn't support it natively. */}
            <View className="flex-1 items-center justify-center">
              <StyledTextInput
                ref={inputRef}
                fieldSize="md"
                value={isFocused ? inputUrl : displayUrl}
                onChangeText={onInputChange}
                onSubmitEditing={onUrlSubmit}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={t("discovery.urlBarPlaceholder")}
                placeholderTextColor={themeColors.text.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="web-search"
                lineBreakModeIOS="tail"
                selection={cursorSelection}
                onSelectionChange={handleSelectionChange}
                style={{
                  textAlign: isFocused ? "left" : "center",
                  fontWeight: "500",
                  ...(!isFocused && isAndroid
                    ? { opacity: 0, position: "absolute" as const }
                    : {}),
                }}
              />
              {!isFocused && isAndroid && (
                <TouchableOpacity
                  onPress={() => inputRef.current?.focus()}
                  className="flex-1 w-full justify-center items-center"
                  activeOpacity={0.7}
                >
                  <Text
                    sm
                    medium
                    numberOfLines={1}
                    textAlign="center"
                    color={
                      inputUrl
                        ? themeColors.text.primary
                        : themeColors.text.secondary
                    }
                  >
                    {displayUrl || t("discovery.urlBarPlaceholder")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Right icon area — cross-fade between clear button and context menu */}
            <View
              style={{ width: ICON_SIZE, height: INPUT_HEIGHT }}
              className="items-center justify-center"
            >
              {inputUrl.length > 0 && (
                <Animated.View style={focusedStyle}>
                  <TouchableOpacity
                    onPress={handleClear}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.clear")}
                  >
                    <Icon.XCircle
                      size={ICON_SIZE}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
              {!isHomePage && (
                <Animated.View
                  style={[unfocusedStyle, { position: "absolute" as const }]}
                >
                  <ContextMenuButton
                    contextMenuProps={{
                      actions: contextMenuActions,
                    }}
                    side="top"
                    align="end"
                    sideOffset={8}
                  >
                    <Icon.DotsHorizontal
                      size={ICON_SIZE}
                      color={themeColors.text.secondary}
                    />
                  </ContextMenuButton>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Right button area — cross-fade between cancel and tab count.
               When unfocused, container is clamped to 40px (matching tab count).
               When focused, it expands to fit the cancel label naturally. */}
          <Animated.View
            style={[
              { height: BUTTON_SIZE, justifyContent: "center" as const },
              rightButtonStyle,
            ]}
          >
            <Animated.View style={focusedStyle}>
              <TouchableOpacity
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Text md medium>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={[unfocusedStyle, { position: "absolute" as const }]}
            >
              <TouchableOpacity
                onPress={onShowTabs}
                style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
                className="bg-background-tertiary justify-center items-center rounded-lg"
                accessibilityRole="button"
                accessibilityLabel={t("discovery.showTabs", {
                  count: tabsCount,
                })}
              >
                <Text sm semiBold>
                  {tabsCount > 9 ? "9+" : tabsCount}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  },
);

BottomNavigationBar.displayName = "BottomNavigationBar";

export default BottomNavigationBar;
