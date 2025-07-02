import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  BottomTabHeaderProps,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import ContextMenuButton from "components/ContextMenuButton";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import Icon from "components/sds/Icon";
import {
  ROOT_NAVIGATOR_ROUTES,
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useMemo } from "react";
import { Platform } from "react-native";

interface UseHomeHeadersProps {
  navigation: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
  hasAssets: boolean;
  connectedAppsBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
}

export const useHomeHeaders = ({
  navigation,
  hasAssets,
  connectedAppsBottomSheetModalRef,
}: UseHomeHeadersProps) => {
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
      ...(hasAssets
        ? [
            {
              title: t("home.actions.manageAssets"),
              systemIcon: Platform.select({
                ios: "pencil",
                android: "baseline_delete",
              }),
              onPress: () =>
                navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK),
            },
          ]
        : []),
      {
        title: t("home.actions.myQRCode"),
        systemIcon: Platform.select({
          ios: "qrcode",
          android: "outline_circle",
        }),
        onPress: () =>
          navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
            showNavigationAsCloseButton: true,
          }),
      },
    ],
    [t, navigation, hasAssets],
  );

  // Memoize the header components to avoid ESLint warnings
  // related to re-rendering issues
  const HeaderComponent = useCallback(
    (props: NativeStackHeaderProps | BottomTabHeaderProps) => (
      <CustomNavigationHeader {...props} />
    ),
    [],
  );

  const HeaderLeftComponent = useCallback(
    () => (
      <ContextMenuButton
        contextMenuProps={{
          actions: menuActions,
        }}
      >
        <Icon.DotsHorizontal color={themeColors.base[1]} />
      </ContextMenuButton>
    ),
    [menuActions, themeColors],
  );

  const HeaderRightComponent = useCallback(
    () => (
      <CustomHeaderButton
        position="right"
        icon={Icon.NotificationBox}
        onPress={() => connectedAppsBottomSheetModalRef.current?.present()}
      />
    ),
    [connectedAppsBottomSheetModalRef],
  );

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: HeaderComponent,
      headerLeft: HeaderLeftComponent,
      headerRight: HeaderRightComponent,
    });
  }, [navigation, HeaderComponent, HeaderLeftComponent, HeaderRightComponent]);
};
