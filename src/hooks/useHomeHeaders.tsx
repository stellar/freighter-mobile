import {
  BottomTabHeaderProps,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import HomeScreenHeader from "components/screens/HomeScreen/HomeScreenHeader";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  ROOT_NAVIGATOR_ROUTES,
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useLayoutEffect } from "react";
import { TouchableOpacity, View } from "react-native";

const HEADER_ICON_SIZE = 24;
const CHEVRON_SIZE = 20;

// Identical touch tiles for the two header-right buttons: 4px horizontal
// slop exactly fills the 8px gap between the 40px buttons, so the tap areas
// are equal-sized and adjacent without overlapping.
const HEADER_BUTTON_HIT_SLOP = { top: 10, bottom: 10, left: 4, right: 4 };

interface UseHomeHeadersProps {
  navigation: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
  onAccountPress: () => void;
  onConnectedAppsPress: () => void;
}

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

  // Account switcher: avatar + name/address dropdown that opens the
  // manage-accounts sheet (Settings and the QR code now live inside it).
  const HeaderLeftComponent = useCallback(
    () => (
      <TouchableOpacity
        className="flex-row items-center gap-[12px]"
        onPress={onAccountPress}
        accessibilityRole="button"
        testID="home-account-switcher"
      >
        <Avatar size="lg" publicAddress={publicKey} />
        <View>
          <View className="flex-row items-center gap-[4px]">
            <Text md medium primary numberOfLines={1}>
              {accountName}
            </Text>
            <Icon.ChevronDownBold
              size={CHEVRON_SIZE}
              color={themeColors.text.primary}
            />
          </View>
          <Text sm medium secondary>
            {truncateAddress(publicKey)}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [onAccountPress, publicKey, accountName, themeColors],
  );

  const HeaderRightComponent = useCallback(
    () => (
      <View className="flex-row items-center gap-[8px]">
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
      header: HeaderComponent,
      headerLeft: HeaderLeftComponent,
      headerRight: HeaderRightComponent,
    });
  }, [navigation, HeaderComponent, HeaderLeftComponent, HeaderRightComponent]);
};
