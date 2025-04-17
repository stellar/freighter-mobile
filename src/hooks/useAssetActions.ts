import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";

/**
 * Hook that provides token-related operations
 */
export const useAssetActions = () => {
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

  /**
   * Copies a token address to clipboard with appropriate notification
   *
   * @param {string} assetId - The asset ID to copy address from
   * @param {string} translationKey - The translation key for the success message
   */
  const copyAssetAddress = (assetId: string, translationKey: string) => {
    if (!assetId) return;

    const splittedId = assetId.split(":");

    // If the ID is a liquidity pool or any asset aside from the native token, we need to copy the issuer
    // Otherwise, we can just copy the ID (native token)
    copyToClipboard(splittedId.length === 2 ? splittedId[1] : assetId, {
      // @ts-expect-error - Translation key type mismatch
      notificationMessage: t(translationKey),
    });
  };

  return {
    copyAssetAddress,
  };
};
