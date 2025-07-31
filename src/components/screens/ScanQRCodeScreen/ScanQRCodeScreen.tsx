/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { QRScanner } from "components/QRScanner";
import { BaseLayout } from "components/layout/BaseLayout";
import CameraNavigationHeader from "components/layout/CameraNavigationHeader";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import Icon from "components/sds/Icon";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

type ScanQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN
>;

const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();

  const handleHeaderLeft = () => {
    navigation.popToTop();
  };

  const handleHeaderRight = () => {
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
  };

  const handleConnect = async (uri: string) => {
    try {
      await walletKit.pair({ uri });
    } catch (err) {
      console.error("X X X X X X Error connecting to wallet > > > > >", err);
    }
  };

  const handleOnRead = (uri: string) => {
    handleConnect(uri);
  };

  return (
    <BaseLayout
      useSafeArea={false}
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <CameraNavigationHeader
        headerTitle={t("scanQRCodeScreen.title")}
        headerLeft={() => (
          <CustomHeaderButton icon={Icon.X} onPress={handleHeaderLeft} />
        )}
        headerRight={() => (
          <CustomHeaderButton
            icon={Icon.QrCode01}
            onPress={handleHeaderRight}
          />
        )}
      />

      <QRScanner onRead={handleOnRead} context="wallet_connect" />
    </BaseLayout>
  );
};

export default ScanQRCodeScreen;
