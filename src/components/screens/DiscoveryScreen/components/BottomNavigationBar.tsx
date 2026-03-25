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
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, TextInput, View, TouchableOpacity } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

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

    // Slide the entire bar up/down in sync with the keyboard.
    const slideStyle = useAnimatedStyle(() => {
      const offset = Math.min(0, keyboardHeight.value + tabBarHeight);
      return { transform: [{ translateY: offset }] };
    });

    // Elements visible when keyboard is closed (unfocused state).
    const unfocusedStyle = useAnimatedStyle(() => ({
      opacity: 1 - progress.value,
      pointerEvents: progress.value < 0.5 ? "auto" : "none",
    }));

    // Elements visible when keyboard is open (focused state).
    const focusedStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
      pointerEvents: progress.value > 0.5 ? "auto" : "none",
    }));

    // Avatar fades out and shrinks so the input can reclaim its space.
    const avatarStyle = useAnimatedStyle(() => ({
      opacity: 1 - progress.value,
      transform: [{ scale: 1 - progress.value }],
      width: 40 * (1 - progress.value),
      pointerEvents: progress.value < 0.5 ? "auto" : "none",
    }));

    const handleInputFocus = useCallback(() => {
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
    }, [onFocusChange]);

    const handleInputBlur = useCallback(() => {
      setIsFocused(false);
      onFocusChange?.(false);
    }, [onFocusChange]);

    const handleCancel = useCallback(() => {
      Keyboard.dismiss();
      onCancel();
    }, [onCancel]);

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
        <View className="flex-row items-center gap-4 bg-background-primary border-t border-border-primary px-6 py-4">
          {/* Avatar — fades out and shrinks during keyboard open */}
          <Animated.View style={avatarStyle}>
            <TouchableOpacity onPress={onAvatarPress}>
              <Avatar size="lg" publicAddress={account?.publicKey ?? ""} />
            </TouchableOpacity>
          </Animated.View>

          <View className="flex-1 h-[40px] flex-row items-center rounded-lg bg-background-tertiary px-3 gap-2">
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
          </View>

          {/* Right button area — cross-fade between cancel and tab count */}
          <View className="h-[40px] justify-center">
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
                className="w-[40px] h-[40px] bg-background-tertiary justify-center items-center rounded-lg"
              >
                <Text sm semiBold>
                  {tabsCount > 9 ? "9+" : tabsCount}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    );
  },
);

BottomNavigationBar.displayName = "BottomNavigationBar";

export default BottomNavigationBar;
