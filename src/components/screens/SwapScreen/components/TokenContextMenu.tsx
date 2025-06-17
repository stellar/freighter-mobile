
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { getContractAddress } from "components/screens/SwapScreen/helpers";
import Icon from "components/sds/Icon";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, Platform, TouchableOpacity } from "react-native";

interface TokenContextMenuProps {
  balance: PricedBalance;
  network: NETWORKS;
}

const TokenContextMenu: React.FC<TokenContextMenuProps> = ({
  balance,
  network,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  const handleCopyContractAddress = () => {
    const contractAddress = getContractAddress(balance);

    if (contractAddress) {
      copyToClipboard(contractAddress, {
        notificationMessage: t("accountAddressCopied"),
      });
    }
  };

  const handleViewOnStellarExpert = async () => {
    const contractAddress = getContractAddress(balance);

    let url: string | undefined;

    if (contractAddress) {
      // For Soroban contracts
      if ("contractId" in balance && balance.contractId) {
        url = `${getStellarExpertUrl(network)}/contract/${contractAddress}`;
      } else {
        // For classic assets
        url = `${getStellarExpertUrl(network)}/asset/${balance.tokenCode}-${contractAddress}`;
      }
    } else if (balance.id === "native") {
      // For native XLM
      url = `${getStellarExpertUrl(network)}/asset/${NATIVE_TOKEN_CODE}`;
    }

    if (url) {
      await Linking.openURL(url);
    }
  };

  const icons = Platform.select({
    ios: {
      copyAddress: "doc.on.doc",
      viewOnExplorer: "link",
    },
    android: {
      copyAddress: "copy",
      viewOnExplorer: "public",
    },
  });

  const actions: MenuItem[] = [
    {
      title: t("swapScreen.copyContractAddress"),
      systemIcon: icons!.copyAddress,
      onPress: handleCopyContractAddress,
    },
    {
      title: t("swapScreen.viewOnStellarExpert"),
      systemIcon: icons!.viewOnExplorer,
      onPress: () => {
        handleViewOnStellarExpert().catch((error) => {
          console.error("Failed to open stellar expert URL:", error);
        });
      },
    },
  ];

  return (
    <TouchableOpacity
      onPress={(e) => {
        e.stopPropagation();
      }}
      activeOpacity={1}
    >
      <ContextMenuButton
        contextMenuProps={{ actions }}
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <Icon.DotsHorizontal size={18} color={themeColors.foreground.primary} />
      </ContextMenuButton>
    </TouchableOpacity>
  );
};

export default TokenContextMenu; 