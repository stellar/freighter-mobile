import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { Linking, Platform, TouchableOpacity, View } from "react-native";

interface SelectTokenBottomSheetProps {
  onTokenSelect: (tokenId: string, tokenSymbol: string) => void;
  customTitle?: string;
  title?: string;
  onClose?: () => void;
  network: NETWORKS;
}

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

  const getContractAddress = (): string | null => {
    if ("contractId" in balance && balance.contractId) {
      return balance.contractId;
    }
    // For classic assets with issuer
    if ("token" in balance && balance.token && "issuer" in balance.token) {
      return balance.token.issuer.key;
    }

    if (balance.id === "native") {
      return null;
    }

    return null;
  };

  const handleCopyContractAddress = () => {
    const contractAddress = getContractAddress();

    if (contractAddress) {
      copyToClipboard(contractAddress, {
        notificationMessage: t("accountAddressCopied"),
      });
    }
  };

  const handleViewOnStellarExpert = async () => {
    const contractAddress = getContractAddress();

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

const SelectTokenBottomSheet: React.FC<SelectTokenBottomSheetProps> = ({
  onTokenSelect,
  customTitle,
  title,
  onClose,
  network,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const renderTokenContextMenu = (balance: PricedBalance) => (
    <TokenContextMenu balance={balance} network={network} />
  );

  return (
    <View className="flex-1">
      <View className="relative flex-row items-center justify-center mb-8">
        {onClose && (
          <TouchableOpacity onPress={onClose} className="absolute left-0">
            <Icon.X size={24} color={themeColors.base[1]} />
          </TouchableOpacity>
        )}
        <Text md medium semiBold>
          {title || t("swapScreen.swapTo")}
        </Text>
      </View>

      <View className="flex-1">
        <TokenSelectionContent
          onTokenPress={onTokenSelect}
          showTitleIcon={false}
          customTitle={customTitle}
          renderRightContent={renderTokenContextMenu}
        />
      </View>
    </View>
  );
};

export default SelectTokenBottomSheet;
