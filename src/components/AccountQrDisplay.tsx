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
 * Account identity + QR + network-pill block shared between
 * `ScanReceiveScreen`'s Receive tab and the Earn flow's in-flow "Receive
 * funds" sheet (design node `9457:46184`) -- both surfaces show the exact
 * same avatar/name/address row, white QR card, and "Stellar" network pill
 * for the active account.
 *
 * Deliberately excludes the network-support caption and the copy CTA: both
 * callers now copy through the same plain `useClipboard` hook, but each has
 * its own surrounding layout (a full-screen tab body vs. sheet content) and
 * its own copy-button styling, so that action stays owned by each caller
 * rather than baked in here.
 *
 * QR size (210) and the white card's padding/radius intentionally match the
 * existing `ReceiveTabView` treatment rather than the Figma mock's 168px --
 * that figure is an artifact of the mock's fixed 360-wide popup canvas, and
 * this component's whole point is to keep the app's one existing "your
 * account's QR code" treatment visually identical everywhere it appears.
 *
 * Same reasoning for the identity-row -> QR gap: this component's outer
 * `gap-8` (32) carries over `ReceiveTabView`'s existing spacing rather than
 * the mock's 24 -- an 8px difference not worth a prop just to shave, given
 * every other rhythm value here (avatar/QR/pill sizing, the 24 QR<->pill
 * gap) already matches the design.
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
  );
};

export default AccountQrDisplay;
