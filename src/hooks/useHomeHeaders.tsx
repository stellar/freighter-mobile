import {
  BottomTabHeaderProps,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import ContextMenuButton from "components/ContextMenuButton";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import HomeScreenHeader from "components/screens/HomeScreen/HomeScreenHeader";
import Icon from "components/sds/Icon";
import { QRCodeSource } from "config/constants";
import {
  ROOT_NAVIGATOR_ROUTES,
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useLayoutEffect, useMemo } from "react";
import { Platform, View } from "react-native";

interface UseHomeHeadersProps {
  navigation: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
}

export const useHomeHeaders = ({ navigation }: UseHomeHeadersProps) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const menuActions = useMemo(
    () => [
      {
        title: t("home.actions.settings"),
        systemIcon: Platform.select({
          ios: "gear",
          android: "baseline_settings",
        }),
        onPress: () =>
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK),
      },
      {
        title: t("home.actions.myQRCode"),
        systemIcon: Platform.select({
          ios: "qrcode",
          android: "qr_code_scanner",
        }),
        onPress: () =>
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
            showNavigationAsCloseButton: false,
          }),
      },
    ],
    [t, navigation],
  );

  // Memoize the header components outside of the useLayoutEffect to improve
  // performance by preventing unnecessary re-creations of the header components.
  const HeaderComponent = useCallback(
    (props: NativeStackHeaderProps | BottomTabHeaderProps) => (
      <HomeScreenHeader {...props} />
    ),
    [],
  );

  const HeaderLeftComponent = useCallback(
    () => (
      <View className="flex-row gap-4">
        <ContextMenuButton
          contextMenuProps={{
            actions: menuActions,
          }}
        >
          <Icon.DotsHorizontal color={themeColors.base[1]} />
        </ContextMenuButton>

        <CustomHeaderButton
          position="left"
          icon={Icon.NotificationBox}
          onPress={() =>
            navigation.navigate(ROOT_NAVIGATOR_ROUTES.CONNECTED_APPS_SCREEN)
          }
        />
      </View>
    ),
    [menuActions, themeColors, navigation],
  );

  const HeaderRightComponent = useCallback(
    () => (
      <CustomHeaderButton
        position="right"
        icon={Icon.Scan}
        onPress={() =>
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN, {
            source: QRCodeSource.WALLET_CONNECT,
          })
        }
      />
    ),
    [navigation],
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
