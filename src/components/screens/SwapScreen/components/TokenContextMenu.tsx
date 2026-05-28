import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import {
  getContractAddress,
  TokenReference,
} from "components/screens/SwapScreen/helpers";
import Icon from "components/sds/Icon";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React from "react";
import { Platform, TouchableOpacity } from "react-native";

interface TokenContextMenuProps {
  token: TokenReference;
  network: NETWORKS;
}

const TokenContextMenu: React.FC<TokenContextMenuProps> = ({
  token,
  network,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { open: openInAppBrowser } = useInAppBrowser();

  const handleCopyContractAddress = () => {
    const contractAddress = getContractAddress({ balance: token, network });

    if (contractAddress) {
      copyToClipboard(contractAddress, {
        notificationMessage: t("accountAddressCopied"),
      });
    }
  };

  const handleViewOnStellarExpert = async () => {
    const contractAddress = getContractAddress({ balance: token, network });

    let url: string | undefined;

    if (contractAddress) {
      if (token.contractId) {
        url = `${getStellarExpertUrl(network)}/contract/${contractAddress}`;
      } else {
        url = `${getStellarExpertUrl(network)}/asset/${token.tokenCode}-${contractAddress}`;
      }
    } else if (token.id === "native") {
      url = `${getStellarExpertUrl(network)}/asset/${NATIVE_TOKEN_CODE}`;
    }

    if (url) {
      await openInAppBrowser(url);
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
          logger.error(
            "TokenContextMenu",
            "Failed to open stellar expert URL:",
            error,
          );
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

export { TokenContextMenu };
export default TokenContextMenu;
