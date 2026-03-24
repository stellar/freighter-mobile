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
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

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
    const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [cursorSelection, setCursorSelection] = useState<
      { start: number; end: number } | undefined
    >(undefined);
    // Whether our search bar TextInput triggered the current keyboard.
    // Used to defer the layout-changing setIsFocused(true) until after
    // the keyboard animation finishes, so the component tree swap
    // (avatar hides, cancel appears) doesn't disrupt the slide animation.
    const pendingFocus = useSharedValue(false);

    const displayUrl = useMemo(() => {
      if (!inputUrl) return "";
      const host = getDisplayHost(inputUrl);
      if (!host) return inputUrl;
      return host.replace(/^www\./, "");
    }, [inputUrl]);

    // keyboardHeight.value is updated every frame on the UI thread during
    // the native keyboard transition (0 when closed, negative when open).
    const animatedStyle = useAnimatedStyle(() => {
      const offset = Math.min(0, keyboardHeight.value + tabBarHeight);
      return { transform: [{ translateY: offset }] };
    });

    const applyFocusedLayout = useCallback(() => {
      setIsFocused(true);
      onFocusChange?.(true);

      const moveCursor = () => setCursorSelection({ start: 0, end: 0 });
      if (isIOS) {
        requestAnimationFrame(moveCursor);
      } else {
        moveCursor();
      }
    }, [onFocusChange]);

    // Defer the layout swap until the keyboard animation finishes.
    useKeyboardHandler(
      {
        onEnd: () => {
          "worklet";

          if (pendingFocus.value) {
            pendingFocus.value = false;
            scheduleOnRN(applyFocusedLayout);
          }
        },
      },
      [applyFocusedLayout],
    );

    const handleInputFocus = useCallback(() => {
      pendingFocus.value = true;
    }, [pendingFocus]);

    const handleInputBlur = useCallback(() => {
      pendingFocus.value = false;
      setIsFocused(false);
      onFocusChange?.(false);
    }, [pendingFocus, onFocusChange]);

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
      <Animated.View style={animatedStyle}>
        <View className="flex-row items-center gap-4 bg-background-primary border-t border-border-primary px-6 py-4">
          {!isFocused && (
            <TouchableOpacity onPress={onAvatarPress}>
              <Avatar size="lg" publicAddress={account?.publicKey ?? ""} />
            </TouchableOpacity>
          )}

          <View className="flex-1 h-[40px] flex-row items-center rounded-lg bg-background-tertiary px-3 gap-2">
            {isFocused ? (
              <Icon.SearchMd size={20} color={themeColors.text.secondary} />
            ) : (
              canGoBack && (
                <TouchableOpacity
                  onPress={onGoBack}
                  disabled={!canGoBack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon.ChevronLeft
                    size={20}
                    color={
                      canGoBack
                        ? themeColors.base[1]
                        : themeColors.text.secondary
                    }
                  />
                </TouchableOpacity>
              )
            )}

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
                keyboardType="default"
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

            {isFocused ? (
              inputUrl.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon.XCircle size={20} color={themeColors.text.secondary} />
                </TouchableOpacity>
              )
            ) : (
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
            )}
          </View>

          {isFocused ? (
            <TouchableOpacity onPress={handleCancel}>
              <Text md medium>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onShowTabs}
              className="w-[40px] h-[40px] bg-background-tertiary justify-center items-center rounded-lg"
            >
              <Text sm semiBold>
                {tabsCount > 9 ? "9+" : tabsCount}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  },
);

BottomNavigationBar.displayName = "BottomNavigationBar";

export default BottomNavigationBar;
