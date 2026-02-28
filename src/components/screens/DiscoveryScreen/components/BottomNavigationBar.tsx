import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { StyledTextInput } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isIOS } from "helpers/device";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useRef } from "react";
import { Animated, Keyboard, View, TouchableOpacity } from "react-native";

interface BottomNavigationBarProps {
  inputUrl: string;
  onInputChange: (text: string) => void;
  onUrlSubmit: () => void;
  onShowTabs: () => void;
  tabsCount: number;
  canGoBack: boolean;
  onGoBack: () => void;
  contextMenuActions: MenuItem[];
}

// Memoize to avoid unnecessary expensive re-renders
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = React.memo(
  ({
    inputUrl,
    onInputChange,
    onUrlSubmit,
    onShowTabs,
    tabsCount,
    canGoBack,
    onGoBack,
    contextMenuActions,
  }) => {
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();
    const { t } = useAppTranslation();
    const tabBarHeight = useBottomTabBarHeight();
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      // On Android, windowSoftInputMode="adjustResize" handles keyboard avoidance natively
      if (!isIOS) {
        return undefined;
      }

      const showListener = Keyboard.addListener("keyboardWillShow", (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -(e.endCoordinates.height - tabBarHeight),
          duration: e.duration ?? 250,
          useNativeDriver: true,
        }).start();
      });

      const hideListener = Keyboard.addListener("keyboardWillHide", (e) => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: e.duration ?? 250,
          useNativeDriver: true,
        }).start();
      });

      return () => {
        showListener.remove();
        hideListener.remove();
      };
    }, [keyboardOffset, tabBarHeight]);

    return (
      <Animated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
        <View className="flex-row items-center gap-4 bg-background-primary border-t border-border-primary px-6 py-4">
          <Avatar size="lg" publicAddress={account?.publicKey ?? ""} />

          <View className="flex-1 h-[40px] flex-row items-center rounded-lg bg-background-tertiary px-3 gap-2">
            <TouchableOpacity
              onPress={onGoBack}
              disabled={!canGoBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon.ChevronLeft
                size={20}
                color={
                  canGoBack ? themeColors.base[1] : themeColors.text.secondary
                }
              />
            </TouchableOpacity>

            <View className="flex-1 items-center justify-center">
              <StyledTextInput
                fieldSize="md"
                value={inputUrl}
                onChangeText={onInputChange}
                onSubmitEditing={onUrlSubmit}
                placeholder={t("discovery.urlBarPlaceholder")}
                placeholderTextColor={themeColors.text.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                lineBreakModeIOS="tail"
                style={{ textAlign: "center", fontWeight: "500" }}
              />
            </View>

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
          </View>

          {/* Show Tabs Button */}
          <TouchableOpacity
            onPress={onShowTabs}
            className="w-[40px] h-[40px] bg-background-tertiary justify-center items-center rounded-lg"
          >
            <Text sm semiBold>
              {tabsCount > 9 ? "9+" : tabsCount}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  },
);

BottomNavigationBar.displayName = "BottomNavigationBar";

export default BottomNavigationBar;
