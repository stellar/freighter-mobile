/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { Account } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback } from "react";
import { TouchableOpacity, View, Platform } from "react-native";
import { analytics } from "services/analytics";

interface AccountItemRowProps {
  account: Account;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: (account: Account) => void;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isSelected: boolean;
  isAccountSwitching: boolean;
  testID?: string;
}

const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  handleCopyAddress,
  handleRenameAccount,
  handleSelectAccount,
  isSelected,
  isAccountSwitching,
  testID,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { open: openInAppBrowser } = useInAppBrowser();

  const truncatedPublicKey = truncateAddress(account.publicKey);

  const icons = Platform.select({
    ios: {
      renameWallet: "pencil",
      copyAddress: "doc.on.doc",
      viewOnExplorer: "safari",
    },
    android: {
      renameWallet: "baseline_edit",
      copyAddress: "copy",
      viewOnExplorer: "public",
    },
  });

  const handleViewOnExplorer = async () => {
    const url = `${getStellarExpertUrl(network)}/account/${account.publicKey}`;
    analytics.track(AnalyticsEvent.VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT);

    await openInAppBrowser(url);
  };

  const actions: MenuItem[] = [
    {
      title: t("home.manageAccount.renameWallet"),
      systemIcon: icons!.renameWallet,
      disabled: isAccountSwitching,
      onPress: () => handleRenameAccount(account),
    },
    {
      title: t("home.manageAccount.copyAddress"),
      systemIcon: icons!.copyAddress,
      disabled: isAccountSwitching,
      onPress: () => handleCopyAddress(account.publicKey),
    },
    {
      title: t("home.manageAccount.viewOnExplorer"),
      systemIcon: icons!.viewOnExplorer,
      disabled: isAccountSwitching,
      onPress: handleViewOnExplorer,
    },
  ];

  const handleSelectAccountPress = useCallback(() => {
    handleSelectAccount(account.publicKey);
  }, [account.publicKey, handleSelectAccount]);

  return (
    <View
      className="flex-row justify-between items-center flex-1 h-16 mb-2"
      testID={testID}
    >
      <TouchableOpacity
        className="flex-row justify-between items-center flex-1"
        onPress={handleSelectAccountPress}
        disabled={isAccountSwitching}
        delayPressIn={DEFAULT_PRESS_DELAY}
        testID={testID ? `${testID}-select` : undefined}
      >
        <View className="flex-row items-center flex-1">
          <Avatar
            size="md"
            publicAddress={account.publicKey}
            isSelected={isSelected}
          />
          <View className="ml-4 flex-1 mr-2">
            <Text md primary medium numberOfLines={1}>
              {account.name}
            </Text>
            <View className="flex-row items-center">
              <Text sm secondary medium numberOfLines={1}>
                {truncatedPublicKey}
              </Text>
              {account.importedFromSecretKey && (
                <>
                  <Text sm secondary medium>
                    {" • "}
                  </Text>
                  <Text sm secondary medium>
                    {t("home.account.imported")}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <ContextMenuButton
        contextMenuProps={{ actions }}
        testID={testID ? `${testID}-context-menu` : undefined}
      >
        <Icon.DotsHorizontal color={themeColors.foreground.primary} />
      </ContextMenuButton>
    </View>
  );
};

export default AccountItemRow;
