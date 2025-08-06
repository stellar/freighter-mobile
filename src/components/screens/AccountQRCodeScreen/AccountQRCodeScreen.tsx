/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { logos } from "assets/logos";
import { BaseLayout } from "components/layout/BaseLayout";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useLayoutEffect } from "react";
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

  useRightHeaderButton({
    hidden: !showNavigationAsCloseButton,
    icon: Icon.Scan,
    onPress: () => {
      const routes = navigation.getState()?.routes ?? [];
      const scanRouteIndex = routes.findIndex(
        (r) => r.name === ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN,
      );

      // If the scan route is already in the stack, pop to it
      // Otherwise, navigate to it
      if (scanRouteIndex !== -1) {
        navigation.popTo(ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN);
      } else {
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN);
      }
    },
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
    </BaseLayout>
  );
};

export default AccountQRCodeScreen;
