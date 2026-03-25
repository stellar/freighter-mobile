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
import { Keyboard, TextInput, View, TouchableOpacity } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

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
    onFocusChange,
  }) => {
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();
    const { t } = useAppTranslation();
    const tabBarHeight = useBottomTabBarHeight();
    const { height: keyboardHeight, progress } =
      useReanimatedKeyboardAnimation();
    const inputRef = useRef<TextInput>(null);
    // isFocused is only used for input value/alignment and Android overlay.
    // Visual transitions (avatar, icons, buttons) are driven by the keyboard
    // progress SharedValue so they animate in sync with the keyboard slide.
    const [isFocused, setIsFocused] = useState(false);
    // SharedValue mirror of isFocused so worklets can distinguish between
    // the search bar owning the keyboard vs a WebView input.
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
    const IOS_GAP = 10;
    const slideStyle = useAnimatedStyle(() => {
      if (isOwnKeyboard.value) {
        const gap = isIOS ? IOS_GAP * progress.value : 0;
        const offset = Math.min(0, keyboardHeight.value + tabBarHeight - gap);
        return {
          transform: [{ translateY: offset }],
          opacity: 1,
          pointerEvents: "auto" as const,
        };
      }
      // WebView keyboard — fade out
      return {
        transform: [{ translateY: 0 }],
        opacity: 1 - progress.value,
        pointerEvents:
          progress.value > 0.5 ? ("none" as const) : ("auto" as const),
      };
    });

    // Elements visible when keyboard is closed (unfocused state).
    // Only transition when the search bar owns the keyboard.
    const unfocusedStyle = useAnimatedStyle(() => {
      const p = isOwnKeyboard.value ? progress.value : 0;
      return {
        opacity: 1 - p,
        pointerEvents: p < 0.5 ? "auto" : "none",
      };
    });

    // Elements visible when keyboard is open (focused state).
    const focusedStyle = useAnimatedStyle(() => {
      const p = isOwnKeyboard.value ? progress.value : 0;
      return {
        opacity: p,
        pointerEvents: p > 0.5 ? "auto" : "none",
      };
    });

    // On iOS, the bar gets rounded corners and side/bottom borders when
    // focused to match the iOS 26 keyboard style.
    const barContainerStyle = useAnimatedStyle(() => {
      if (!isIOS) return {};
      const p = isOwnKeyboard.value ? progress.value : 0;
      return {
        borderRadius: 20 * p,
        marginHorizontal: 6 * p,
        overflow: "hidden" as const,
        borderLeftWidth: p,
        borderRightWidth: p,
        borderBottomWidth: p,
      };
    });

    // Search bar left margin: 16px when unfocused (space after avatar),
    // 0px when focused (avatar is gone).
    const searchBarStyle = useAnimatedStyle(() => {
      const p = isOwnKeyboard.value ? progress.value : 0;
      return { marginLeft: 16 * (1 - p) };
    });

    // Right button container: 40px when unfocused (matches tab count),
    // expands to fit cancel label when focused. Keeps a left margin so
    // there's always spacing between the search bar and this button.
    const rightButtonStyle = useAnimatedStyle(() => {
      const p = isOwnKeyboard.value ? progress.value : 0;
      return {
        maxWidth: 40 + 60 * p,
        overflow: "hidden" as const,
        marginLeft: 16,
      };
    });

    // Avatar fades out and shrinks so the input can reclaim its space.
    const avatarStyle = useAnimatedStyle(() => {
      const p = isOwnKeyboard.value ? progress.value : 0;
      return {
        opacity: 1 - p,
        transform: [{ scale: 1 - p }],
        width: 40 * (1 - p),
        pointerEvents: p < 0.5 ? "auto" : "none",
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
            <TouchableOpacity onPress={onAvatarPress}>
              <Avatar size="lg" publicAddress={account?.publicKey ?? ""} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={searchBarStyle}
            className="flex-1 h-[40px] flex-row items-center rounded-lg bg-background-tertiary px-3 gap-2"
          >
            {/* Left icon area — cross-fade between search icon and back button */}
            <View className="w-[20px] h-[40px] items-center justify-center">
              <Animated.View style={focusedStyle}>
                <Icon.SearchMd size={20} color={themeColors.text.secondary} />
              </Animated.View>
              {canGoBack && (
                <Animated.View
                  style={[unfocusedStyle, { position: "absolute" as const }]}
                >
                  <TouchableOpacity
                    onPress={onGoBack}
                    disabled={!canGoBack}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon.ChevronLeft
                      size={20}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {/* URL display strategy:
               - iOS: TextInput with lineBreakModeIOS="tail" handles ellipsis natively.
               - Android: TextInput doesn't support ellipsis, so when unfocused we hide it
                 and overlay a Text component with numberOfLines={1} (ellipsizeMode defaults
                 to "tail"). Tapping the overlay focuses the hidden input for editing. */}
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
                  // Hidden on Android when unfocused; Text overlay handles display
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
            <View className="w-[20px] h-[40px] items-center justify-center">
              {inputUrl.length > 0 && (
                <Animated.View style={focusedStyle}>
                  <TouchableOpacity
                    onPress={handleClear}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon.XCircle
                      size={20}
                      color={themeColors.text.secondary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
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
                    size={20}
                    color={themeColors.text.secondary}
                  />
                </ContextMenuButton>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Right button area — cross-fade between cancel and tab count.
               When unfocused, container is clamped to 40px (matching tab count).
               When focused, it expands to fit the cancel label naturally. */}
          <Animated.View
            style={[
              { height: 40, justifyContent: "center" as const },
              rightButtonStyle,
            ]}
          >
            <Animated.View style={focusedStyle}>
              <TouchableOpacity onPress={handleCancel}>
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
                className="size-[40px] bg-background-tertiary justify-center items-center rounded-lg"
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
