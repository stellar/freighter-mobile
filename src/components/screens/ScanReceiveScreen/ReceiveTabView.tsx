import { AccountQrDisplay } from "components/AccountQrDisplay";
import { Button, IconPosition } from "components/sds/Button";
import { BUTTON_THEME } from "components/sds/Button/theme";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View } from "react-native";

/**
 * Receive tab body for ScanReceiveScreen: the active account's QR code with a
 * copy-address action. Opaque; the parent screen supplies top padding for the
 * floating header and bottom safe-area padding.
 */
export const ReceiveTabView: React.FC = () => {
  const { account } = useGetActiveAccount();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const publicKey = account?.publicKey ?? "";

  return (
    <View className="flex-1 px-6">
      <View className="flex-1 items-center justify-center">
        <AccountQrDisplay
          publicKey={publicKey}
          accountName={account?.accountName}
        />
      </View>

      <View className="gap-6">
        <Text md medium secondary textAlign="center">
          {t("scanReceiveScreen.receive.networkSupport")}
        </Text>
        <Button
          isFullWidth
          tertiary
          icon={
            <Icon.Copy01 size={18} color={BUTTON_THEME.colors.tertiary.text} />
          }
          iconPosition={IconPosition.LEFT}
          onPress={() => copyToClipboard(publicKey)}
        >
          {t("scanReceiveScreen.receive.copyButton")}
        </Button>
      </View>
    </View>
  );
};
