import { mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { getNativeContractId, isNativeAssetId } from "helpers/assetIdentity";
import { isPublicKeyValid } from "helpers/balances";
import { getTokenSacAddress, isContractId } from "helpers/soroban";
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

      const { networkPassphrase } = mapNetworkToNetworkDetails(network);
      let address: string;
      if (isNativeAssetId(tokenId)) {
        // XLM's id is its code, not an address. Copy the native Stellar
        // Asset Contract id for the active network.
        address = getNativeContractId(networkPassphrase);
      } else if (tokenId.includes(":")) {
        // A symbol can contain a colon, so the address is after the last one.
        const separator = tokenId.lastIndexOf(":");
        const code = tokenId.slice(0, separator);
        const issuer = tokenId.slice(separator + 1);
        if (isContractId(issuer)) {
          // SYMBOL:CONTRACTID copies the contract id.
          address = issuer;
        } else if (isPublicKeyValid(issuer)) {
          // CODE:ISSUER copies the classic asset's Stellar Asset Contract id,
          // not the issuer account.
          address = getTokenSacAddress(code, issuer, networkPassphrase);
        } else {
          // A liquidity pool share is `<poolId>:lp`. Copy the pool id.
          address = code;
        }
      } else {
        // A bare contract id is the address.
        address = tokenId;
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
