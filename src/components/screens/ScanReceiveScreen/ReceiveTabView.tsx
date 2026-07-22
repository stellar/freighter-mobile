import { logos } from "assets/logos";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { Image, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

const QR_SIZE = 210;

/**
 * Receive tab body for ScanReceiveScreen: the active account's QR code with a
 * copy-address action. Opaque; the parent screen supplies top padding for the
 * floating header and bottom safe-area padding.
 */
export const ReceiveTabView: React.FC = () => {
  const { account } = useGetActiveAccount();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const publicKey = account?.publicKey ?? "";

  return (
    <View className="flex-1 px-6">
      <View className="flex-1 items-center justify-center gap-8">
        <View className="flex-row items-center gap-3">
          <Avatar size="md" publicAddress={publicKey} />
          <View>
            <Text lg medium>
              {account?.accountName ?? ""}
            </Text>
            <Text md medium secondary>
              {truncateAddress(publicKey)}
            </Text>
          </View>
        </View>

        <View className="items-center gap-6">
          <View className="bg-white p-4 rounded-2xl">
            <QRCode
              size={pxValue(QR_SIZE)}
              logo={logos.freighter2d}
              value={publicKey}
              quietZone={6}
              logoMargin={12}
              logoSize={60}
              logoBackgroundColor="transparent"
              ecl="H"
            />
          </View>

          <View className="flex-row items-center gap-2 bg-background-tertiary rounded-full px-3 py-2">
            <Image
              source={logos.stellar}
              className="w-4 h-4 rounded-full"
              resizeMode="contain"
            />
            <Text sm medium>
              {t("scanReceiveScreen.receive.network")}
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-6">
        <Text sm medium secondary textAlign="center">
          {t("scanReceiveScreen.receive.networkSupport")}
        </Text>
        <Button
          isFullWidth
          tertiary
          icon={
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
          }
          onPress={() => copyToClipboard(publicKey)}
        >
          {t("scanReceiveScreen.receive.copyButton")}
        </Button>
      </View>
    </View>
  );
};
