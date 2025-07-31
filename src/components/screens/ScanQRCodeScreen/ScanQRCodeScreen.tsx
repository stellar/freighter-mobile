/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useLayoutEffect } from "react";
import { View } from "react-native";

type ScanQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN
>;

const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();

  // useLayoutEffect is the official recommended hook to use for setting up
  // the navigation headers to prevent UI flickering.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <CustomHeaderButton
          icon={Icon.X}
          onPress={() => navigation.popToTop()}
        />
      ),
    });
  }, [navigation]);

  useRightHeaderButton({
    icon: Icon.QrCode01,
    onPress: () => {
      const routes = navigation.getState()?.routes ?? [];
      const scanRouteIndex = routes.findIndex(
        (r) => r.name === ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN,
      );

      // If the qr code screen is already in the stack, pop to it
      // Otherwise, navigate to it
      if (scanRouteIndex !== -1) {
        navigation.popTo(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
          showNavigationAsCloseButton: true,
        });
      } else {
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
          showNavigationAsCloseButton: true,
        });
      }
    },
  });

  return (
    <BaseLayout>
      <View className="flex-1 items-center justify-center">
        <Text md primary medium>
          {t("scanQRCodeScreen.scanWCQrCode")}
        </Text>
      </View>
    </BaseLayout>
  );
};

export default ScanQRCodeScreen;
