import {
  BottomTabHeaderProps,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import {
  CustomHeaderButton,
  HEADER_BUTTON_BOX,
} from "components/layout/CustomHeaderButton";
import HomeScreenHeader from "components/screens/HomeScreen/HomeScreenHeader";
import Avatar, { AvatarSizes } from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  ROOT_NAVIGATOR_ROUTES,
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useLayoutEffect } from "react";
import { TouchableOpacity, View } from "react-native";

const HEADER_ICON_SIZE = 24;
const CHEVRON_SIZE = 16;
const CHEVRON_STROKE_WIDTH = 2;

// Identical touch tiles for the two header-right buttons: each reaches 6pt
// into the 12pt gap between them, so the tap areas are equal-sized and meet
// in the middle of the gap without overlapping.
const HEADER_BUTTON_HIT_SLOP = { top: 10, bottom: 10, left: 6, right: 6 };

// The account switcher is only the bar's 32pt row tall, so it reaches the same
// 10pt above and below as the header buttons. The bar pads at least 45pt above
// the row and 24pt below it inside its own bounds, so on iOS's new
// architecture, which drops touches outside an ancestor's bounds, the slop
// still takes taps.
const ACCOUNT_SWITCHER_HIT_SLOP = { top: 10, bottom: 10 };

// The avatar's box takes the bar's button height, which scales, so the row
// is as tall as the other tabs'. It has no width of its own, so the fixed
// 32pt avatar keeps its left edge on the bar's inset at every width.
const AVATAR_BOX_STYLE = { height: HEADER_BUTTON_BOX.height };

interface UseHomeHeadersProps {
  navigation: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
  onAccountPress: () => void;
  onConnectedAppsPress: () => void;
}

/**
 * Sets Home's header on the tab navigator: `HomeScreenHeader`, floating over
 * the screen (`headerTransparent`), with the account switcher on the left
 * (the avatar, the account name and a chevron; a tap anywhere on it calls
 * `onAccountPress`) and the Scan and Connected Apps buttons on the right.
 */
export const useHomeHeaders = ({
  navigation,
  onAccountPress,
  onConnectedAppsPress,
}: UseHomeHeadersProps) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();

  const accountName = account?.accountName ?? "";
  const publicKey = account?.publicKey ?? "";

  // Memoize the header components outside of the useLayoutEffect to improve
  // performance by preventing unnecessary re-creations of the header components.
  const HeaderComponent = useCallback(
    (props: NativeStackHeaderProps | BottomTabHeaderProps) => (
      <HomeScreenHeader {...props} />
    ),
    [],
  );

  // Account switcher: avatar, name and chevron that open the manage-accounts
  // sheet (Settings and the QR code now live inside it).
  const HeaderLeftComponent = useCallback(
    () => (
      <TouchableOpacity
        // flex-1 + the shrink chain below cap the switcher at the space the
        // header row actually has (long names ellipsize instead of pushing
        // the right-side buttons); mr-[12px] keeps a gap from the Scan button.
        className="flex-1 flex-row items-center gap-[8px] mr-[12px]"
        onPress={onAccountPress}
        hitSlop={ACCOUNT_SWITCHER_HIT_SLOP}
        accessibilityRole="button"
        // The account name is the whole announcement: the avatar and the
        // chevron have nothing to say.
        accessibilityLabel={accountName}
        testID="home-account-switcher"
      >
        {/* The row is as tall as its tallest child. The avatar is a fixed
            32pt, so it sits vertically centred in a box as tall as the bar's
            buttons: the row then matches the other tabs' on any screen. */}
        <View className="justify-center" style={AVATAR_BOX_STYLE}>
          <Avatar size={AvatarSizes.SMALL_MEDIUM} publicAddress={publicKey} />
        </View>
        <View className="shrink">
          <View className="flex-row items-center gap-[4px]">
            <View className="shrink">
              <Text lg semiBold primary numberOfLines={1}>
                {accountName}
              </Text>
            </View>
            <Icon.ChevronDown
              size={CHEVRON_SIZE}
              strokeWidth={CHEVRON_STROKE_WIDTH}
              color={themeColors.gray[9]}
            />
          </View>
        </View>
      </TouchableOpacity>
    ),
    [onAccountPress, publicKey, accountName, themeColors],
  );

  const HeaderRightComponent = useCallback(
    () => (
      <View className="flex-row items-center gap-[12px]">
        <CustomHeaderButton
          position="right"
          icon={Icon.ScanCircle}
          iconSize={HEADER_ICON_SIZE}
          iconColor={themeColors.text.secondary}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          testID="home-screen-scan-button"
          accessibilityLabel={t("homeScanner.title")}
          onPress={() =>
            navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN, {
              initialTab: "scan",
            })
          }
        />
        <CustomHeaderButton
          position="right"
          icon={Icon.NotificationBox}
          iconSize={HEADER_ICON_SIZE}
          iconColor={themeColors.text.secondary}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          testID="home-screen-connected-apps-button"
          accessibilityLabel={t("connectedApps.title")}
          onPress={onConnectedAppsPress}
        />
      </View>
    ),
    [themeColors, navigation, onConnectedAppsPress, t],
  );

  // useLayoutEffect is the official recommended hook to use for setting up
  // the navigation headers to prevent UI flickering.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      // Home's content scrolls up under the header's fade (HomeScreenHeader),
      // and HomeScreen starts it below the header.
      headerTransparent: true,
      header: HeaderComponent,
      headerLeft: HeaderLeftComponent,
      headerRight: HeaderRightComponent,
    });
  }, [navigation, HeaderComponent, HeaderLeftComponent, HeaderRightComponent]);
};
