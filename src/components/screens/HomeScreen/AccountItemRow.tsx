/* eslint-disable @typescript-eslint/no-misused-promises */
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { Account } from "config/types";
import { truncateAddress } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View, Platform, Linking } from "react-native";

interface AccountItemRowProps {
  account: Account;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: (account: Account) => void;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isSelected: boolean;
}

const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  handleCopyAddress,
  handleRenameAccount,
  handleSelectAccount,
  isSelected,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

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
    const url = `${getStellarExpertUrl(NETWORKS.PUBLIC)}/account/${account.publicKey}`;
    await Linking.openURL(url);
  };

  const actions: MenuItem[] = [
    {
      title: t("home.manageAccount.renameWallet"),
      systemIcon: icons!.renameWallet,
      onPress: () => handleRenameAccount(account),
    },
    {
      title: t("home.manageAccount.copyAddress"),
      systemIcon: icons!.copyAddress,
      onPress: () => handleCopyAddress(account.publicKey),
    },
    {
      title: t("home.manageAccount.viewOnExplorer"),
      systemIcon: icons!.viewOnExplorer,
      onPress: handleViewOnExplorer,
    },
  ];

  return (
    <View className="flex-row justify-between items-center flex-1 h-16 mb-2">
      <TouchableOpacity
        className="flex-row justify-between items-center flex-1"
        onPress={() => handleSelectAccount(account.publicKey)}
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
            <Text sm secondary medium numberOfLines={1}>
              {truncatedPublicKey}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <ContextMenuButton contextMenuProps={{ actions }}>
        <Icon.DotsHorizontal size={24} color={themeColors.foreground.primary} />
      </ContextMenuButton>
    </View>
  );
};

export default AccountItemRow;
