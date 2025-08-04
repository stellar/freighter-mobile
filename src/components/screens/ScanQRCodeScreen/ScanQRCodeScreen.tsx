/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { logos } from "assets/logos";
import { QRScanner } from "components/QRScanner";
import { BaseLayout } from "components/layout/BaseLayout";
import CameraNavigationHeader from "components/layout/CameraNavigationHeader";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { View, Image, TouchableOpacity } from "react-native";

type ScanQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN
>;

const PAIRING_SUCCESS_VISUALDELAY_MS = 1000;
const PAIRING_ERROR_VISUALDELAY_MS = 500;

const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();

  const [isConnecting, setIsConnecting] = useState(false);
  const [dappUri, setDappUri] = useState("");
  const [error, setError] = useState("");

  const closeScreen = () => {
    navigation.popToTop();
  };

  const handleHeaderLeft = () => {
    closeScreen();
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

  const handleClearUri = () => {
    setDappUri("");
    setError("");
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(setDappUri);
  };

  const handleConnect = async (uri: string) => {
    if (!uri) {
      setError(t("scanQRCodeScreen.invalidUriError"));
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      await walletKit.pair({ uri });

      // Add a delay for a smooth UX while we wait for the bottom sheet to animate
      setTimeout(() => {
        closeScreen();
      }, PAIRING_SUCCESS_VISUALDELAY_MS);
    } catch (err) {
      // Add a delay for a smooth UX to prevent UI flickering when displaying the error
      setTimeout(() => {
        setIsConnecting(false);
        setError(
          err instanceof Error
            ? err.message
            : t("scanQRCodeScreen.pairingError"),
        );
      }, PAIRING_ERROR_VISUALDELAY_MS);
    }
  };

  const handleOnRead = (uri: string) => {
    handleConnect(uri);
  };

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
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

      {/* URI Input Section */}
      <View className="flex-1 justify-end z-[100]">
        <View className="bg-background-tertiary rounded-2xl py-4 px-5 gap-3">
          <View className="flex-row items-center">
            <View className="w-6 h-6 rounded-full overflow-hidden mr-2 justify-center items-center">
              <Image
                source={logos.walletConnect}
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
              />
            </View>
            <Text sm secondary medium>
              {t("scanQRCodeScreen.connectWithWalletConnect")}
            </Text>
          </View>

          <Input
            editable={false}
            placeholder={t("scanQRCodeScreen.inputPlaceholder")}
            fieldSize="md"
            value={dappUri}
            onChangeText={setDappUri}
            error={error}
            rightElement={
              <TouchableOpacity className="p-3 mr-1" onPress={handleClearUri}>
                <Icon.X size={16} color={themeColors.foreground.primary} />
              </TouchableOpacity>
            }
            endButton={{
              content: (
                <Icon.Clipboard
                  size={16}
                  color={themeColors.foreground.primary}
                />
              ),
              onPress: handlePasteFromClipboard,
              disabled: isConnecting,
              backgroundColor: themeColors.background.secondary,
            }}
          />

          <Button
            isLoading={isConnecting}
            disabled={isConnecting || !dappUri.trim()}
            lg
            tertiary
            onPress={() => handleOnRead(dappUri)}
          >
            {t("scanQRCodeScreen.connect")}
          </Button>
        </View>
      </View>

      <QRScanner onRead={handleOnRead} context="wallet_connect" />
    </BaseLayout>
  );
};

export default ScanQRCodeScreen;
