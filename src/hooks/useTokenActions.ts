import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useCallback } from "react";

/**
 * Hook that provides token-related operations
 */
export const useTokenActions = () => {
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

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

      const splittedId = tokenId.split(":");

      // If the ID is a liquidity pool or any token aside from the native token, we need to copy the issuer
      // Otherwise, we can just copy the ID (native token)
      copyToClipboard(splittedId.length === 2 ? splittedId[1] : tokenId, {
        // @ts-expect-error - Translation key type mismatch
        notificationMessage: t(translationKey),
      });
    },
    [copyToClipboard, t],
  );

  return {
    copyTokenAddress,
  };
};
