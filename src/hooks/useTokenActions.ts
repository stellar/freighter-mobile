import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { getNativeContractId, isNativeAssetId } from "helpers/assetIdentity";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useCallback } from "react";

/**
 * Hook that provides token-related operations
 */
export const useTokenActions = () => {
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { network } = useAuthenticationStore();

  /**
   * Copies a token address to clipboard with appropriate notification.
   * Memoized so consumers that depend on its identity (e.g. header-menu
   * useMemo/setOptions) don't rebuild on every render.
   *
   * @param tokenId - The token ID to copy address from
   * @param translationKey - The translation key for the success message
   */
  const copyTokenAddress = useCallback(
    (tokenId: string, translationKey: string) => {
      if (!tokenId) return;

      let address: string;
      if (isNativeAssetId(tokenId)) {
        // XLM's id is its code, not an address. Copy the native Stellar
        // Asset Contract id for the active network.
        address = getNativeContractId(
          mapNetworkToNetworkDetails(network).networkPassphrase,
        );
      } else {
        // CODE:ISSUER copies the issuer. A contract or pool id has no colon
        // and is the address.
        const splittedId = tokenId.split(":");
        address = splittedId.length === 2 ? splittedId[1] : tokenId;
      }

      copyToClipboard(address, {
        // @ts-expect-error - Translation key type mismatch
        notificationMessage: t(translationKey),
      });
    },
    [copyToClipboard, t, network],
  );

  return {
    copyTokenAddress,
  };
};
