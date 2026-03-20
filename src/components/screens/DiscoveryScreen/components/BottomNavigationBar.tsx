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
import {
  Animated,
  Keyboard,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";

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
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [cursorSelection, setCursorSelection] = useState<
      { start: number; end: number } | undefined
    >(undefined);
    // Tracks whether the search bar (not a WebView input) opened the keyboard
    const isSearchBarActive = useRef(false);

    const displayUrl = useMemo(() => {
      if (!inputUrl) return "";
      const host = getDisplayHost(inputUrl);
      if (!host) return inputUrl;
      return host.replace(/^www\./, "");
    }, [inputUrl]);

    // Keyboard avoidance animation is iOS only. On Android,
    // adjustResize in AndroidManifest handles it at the system level.
    useEffect(() => {
      const showEvent = isIOS ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent = isIOS ? "keyboardWillHide" : "keyboardDidHide";

      const showListener = Keyboard.addListener(showEvent, (e) => {
        // Ignore keyboards opened by WebView inputs
        if (!inputRef.current?.isFocused()) return;

        isSearchBarActive.current = true;
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

        if (isIOS) {
          Animated.timing(keyboardOffset, {
            toValue: -(e.endCoordinates.height - tabBarHeight),
            duration: e.duration ?? 250,
            useNativeDriver: true,
          }).start();
        }
      });

      const hideListener = Keyboard.addListener(hideEvent, (e) => {
        if (!isSearchBarActive.current) return;

        isSearchBarActive.current = false;
        setIsFocused(false);
        onFocusChange?.(false);
        // Explicitly blur so the next focus() call from the overlay isn't a
        // no-op. Android's hardware back button dismisses the keyboard without
        // blurring the TextInput, which leaves it in a "focused" state where
        // calling focus() again does nothing.
        inputRef.current?.blur();

        if (isIOS) {
          Animated.timing(keyboardOffset, {
            toValue: 0,
            duration: e.duration ?? 250,
            useNativeDriver: true,
          }).start();
        }
      });

      return () => {
        showListener.remove();
        hideListener.remove();
      };
    }, [keyboardOffset, tabBarHeight, onFocusChange]);

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
      <Animated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
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
