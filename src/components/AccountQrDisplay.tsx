import { logos } from "assets/logos";
import { Avatar } from "components/sds/Avatar";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { Image, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

const QR_SIZE = 210;

export interface AccountQrDisplayProps {
  /** The account's Stellar public key -- both the QR payload and the
   *  truncated address line are derived from this. */
  publicKey: string;
  /** Display name shown above the truncated address. Renders an empty
   *  string when omitted (mirrors the account-not-yet-resolved state the
   *  original `ReceiveTabView` guarded the same way). */
  accountName?: string;
  testID?: string;
}

/**
 * The account's QR on its white card, on its own: the Varial mark in the
 * middle and a white ground in both themes, so it always scans. `size` is the
 * QR's own size, before the card's padding. Earn's "Receive" sheet sets its
 * own size; `AccountQrDisplay` below keeps the Receive tab's 210.
 */
export const AccountQrCode: React.FC<{ publicKey: string; size?: number }> = ({
  publicKey,
  size = QR_SIZE,
}) => (
  <View className="bg-white p-4 rounded-2xl">
    <QRCode
      size={pxValue(size)}
      logo={logos.varial2d}
      value={publicKey}
      quietZone={6}
      logoMargin={7}
      logoSize={60}
      logoBackgroundColor="transparent"
      ecl="H"
    />
  </View>
);

/**
 * The Receive tab's account block: the avatar, name and truncated address,
 * the QR card, and the "Stellar" network pill for the active account.
 *
 * Leaves out the network-support caption and the copy button, which the tab
 * lays out itself.
 */
export const AccountQrDisplay: React.FC<AccountQrDisplayProps> = ({
  publicKey,
  accountName,
  testID,
}) => {
  const { t } = useAppTranslation();

  return (
    <View className="items-center gap-8" testID={testID}>
      <View className="flex-row items-center gap-3">
        <Avatar size="md" publicAddress={publicKey} />
        <View>
          <Text lg medium>
            {accountName ?? ""}
          </Text>
          <Text md medium secondary>
            {truncateAddress(publicKey)}
          </Text>
        </View>
      </View>

      <View className="items-center gap-6">
        <AccountQrCode publicKey={publicKey} />

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
  );
};

export default AccountQrDisplay;
