/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { logos } from "assets/logos";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { QRCodeSource } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type AccountQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN
>;

const AccountQRCodeScreen: React.FC<AccountQRCodeScreenProps> = ({
  route,
  navigation,
}) => {
  const { account } = useGetActiveAccount();
  const { showNavigationAsCloseButton } = route.params || {};
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const explanationModalRef = useRef<BottomSheetModal>(null);

  // useLayoutEffect is the official recommended hook to use for setting up
  // the navigation headers to prevent UI flickering.
  useLayoutEffect(() => {
    if (showNavigationAsCloseButton) {
      navigation.setOptions({
        headerLeft: () => (
          <CustomHeaderButton
            icon={Icon.X}
            onPress={() => navigation.popToTop()}
          />
        ),
      });
    }
  }, [navigation, showNavigationAsCloseButton]);

  const getRightHeaderIcon = () =>
    showNavigationAsCloseButton ? Icon.Scan : Icon.HelpCircle;

  const handleWalletConnectNavigation = () => {
    // WalletConnect flow: Navigate between QR Scan and QR Address screens
    const routes = navigation.getState()?.routes ?? [];
    const scanRouteIndex = routes.findIndex(
      (r) => r.name === ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN,
    );

    // If the scan route is already in the stack, go back to it
    // Otherwise, navigate to it
    if (scanRouteIndex !== -1) {
      // Calculate how many screens to go back
      const currentIndex = routes.length - 1;
      const stepsBack = currentIndex - scanRouteIndex;
      for (let i = 0; i < stepsBack; i++) {
        navigation.goBack();
      }
    } else {
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN, {
        source: QRCodeSource.WALLET_CONNECT,
      });
    }
  };

  const handleHelpModalPress = () => {
    explanationModalRef.current?.present();
  };

  const handleRightHeaderPress = () => {
    if (showNavigationAsCloseButton) {
      handleWalletConnectNavigation();
    } else {
      handleHelpModalPress();
    }
  };

  useRightHeaderButton({
    icon: getRightHeaderIcon(),
    onPress: handleRightHeaderPress,
  });

  return (
    <BaseLayout>
      <View className="flex-1 gap-[32px]">
        <View className="gap-[16px] items-center">
          <Avatar size="xl" publicAddress={account?.publicKey ?? ""} />
          <View>
            <Text xl medium>
              {account?.accountName ?? ""}
            </Text>
            <Text md medium secondary>
              {truncateAddress(account?.publicKey ?? "")}
            </Text>
          </View>
        </View>
        <View className="items-center w-full">
          {/* NOTE: using png logo for now because it wasnt rendering the svg correctly */}
          <QRCode
            size={pxValue(210)}
            logo={logos.freighter2d}
            value={account?.publicKey ?? ""}
            quietZone={6}
            logoMargin={12}
            logoSize={60}
            logoBackgroundColor="transparent"
            ecl="H"
          />
        </View>
        <View className="items-center justify-center gap-[32px]">
          <Button
            secondary
            lg
            icon={
              <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            }
            onPress={() => {
              copyToClipboard(account?.publicKey ?? "");
            }}
          >
            {t("accountQRCodeScreen.copyButton")}
          </Button>
          <Text md medium secondary textAlign="center">
            {t("accountQRCodeScreen.helperText")}
          </Text>
        </View>
      </View>

      <BottomSheet
        modalRef={explanationModalRef}
        handleCloseModal={() => explanationModalRef.current?.dismiss()}
        customContent={
          <InformationBottomSheet
            title={t("accountQRCodeScreen.title")}
            texts={[
              {
                key: "description",
                value: t("accountQRCodeScreen.bottomSheet.description"),
              },
            ]}
            headerElement={
              <View className="bg-lilac-3 p-2 rounded-[8px]">
                <Icon.QrCode01 themeColor="lilac" size={28} />
              </View>
            }
            onClose={() => explanationModalRef.current?.dismiss()}
          />
        }
      />
    </BaseLayout>
  );
};

export default AccountQRCodeScreen;
