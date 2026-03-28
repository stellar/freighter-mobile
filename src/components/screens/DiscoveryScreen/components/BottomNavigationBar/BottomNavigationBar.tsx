import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import ContextMenuButton from "components/ContextMenuButton";
import {
  BUTTON_SIZE,
  ICON_SIZE,
  INPUT_HEIGHT,
  BottomNavigationBarProps,
} from "components/screens/DiscoveryScreen/components/BottomNavigationBar/constants";
import useAnimatedBarStyles from "components/screens/DiscoveryScreen/components/BottomNavigationBar/useAnimatedBarStyles";
import useKeyboardHandling from "components/screens/DiscoveryScreen/components/BottomNavigationBar/useKeyboardHandling";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { StyledTextInput } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isAndroid } from "helpers/device";
import { getDisplayHost } from "helpers/protocols";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo } from "react";
import { View, TouchableOpacity } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useSharedValue } from "react-native-reanimated";

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
    const isOwnKeyboard = useSharedValue(false);

    const displayUrl = useMemo(() => {
      if (!inputUrl) return "";
      const host = getDisplayHost(inputUrl);
      if (!host) return inputUrl;
      return host.replace(/^www\./, "");
    }, [inputUrl]);

    const {
      slideStyle,
      unfocusedStyle,
      focusedStyle,
      barContainerStyle,
      searchBarStyle,
      rightButtonStyle,
      avatarStyle,
    } = useAnimatedBarStyles({
      isOwnKeyboard,
      progress,
      keyboardHeight,
      tabBarHeight,
    });

    const {
      inputRef,
      isFocused,
      cursorSelection,
      handleInputFocus,
      handleInputBlur,
      handleCancel,
      handleSelectionChange,
      handleClear,
    } = useKeyboardHandling({
      isOwnKeyboard,
      onFocusChange,
      onCancel,
      onInputChange,
    });

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

            {/* URL input area */}
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

          {/* Right button area — cross-fade between cancel and tab count */}
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
