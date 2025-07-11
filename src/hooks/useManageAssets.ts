import { AnalyticsEvent } from "config/analyticsEvents";
import {
  DEFAULT_DECIMALS,
  NETWORKS,
  STORAGE_KEYS,
  VISUAL_DELAY_MS,
} from "config/constants";
import { logger } from "config/logger";
import {
  AssetTypeWithCustomToken,
  CustomToken,
  CustomTokenStorage,
  FormattedSearchAssetRecord,
} from "config/types";
import { ActiveAccount } from "ducks/auth";
import { formatAssetIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { ToastOptions, useToast } from "providers/ToastProvider";
import { useState } from "react";
import { analytics } from "services/analytics";
import {
  buildChangeTrustTx,
  signTransaction,
  submitTx,
} from "services/stellar";
import { dataStorage } from "services/storage/storageFactory";

interface UseManageAssetsProps {
  network: NETWORKS;
  account: ActiveAccount | null;
  onSuccess?: () => void;
}

interface UseManageAssetsReturn {
  addAsset: (
    asset: FormattedSearchAssetRecord,
    onComplete?: () => void,
  ) => Promise<void>;
  removeAsset: (input: RemoveAssetParams) => Promise<void>;
  isAddingAsset: boolean;
  isRemovingAsset: boolean;
}

export interface RemoveAssetParams {
  assetId?: string;
  assetRecord?: FormattedSearchAssetRecord;
  assetType?: AssetTypeWithCustomToken;
  onComplete?: () => void;
}

/**
 * Helper to get CustomTokenStorage from storage
 * @returns The current custom token storage, or an empty object if none exists
 */
const getCustomTokenStorage = async (): Promise<CustomTokenStorage> => {
  const storageData = await dataStorage.getItem(STORAGE_KEYS.CUSTOM_TOKEN_LIST);
  if (!storageData) {
    return {};
  }

  try {
    return JSON.parse(storageData) as CustomTokenStorage;
  } catch (e) {
    logger.error(
      "getCustomTokenStorage",
      "Error parsing custom token storage",
      e,
    );
    return {};
  }
};

/**
 * Helper to save CustomTokenStorage to storage
 * @param storage The updated storage to save
 */
const saveCustomTokenStorage = async (
  storage: CustomTokenStorage,
): Promise<void> => {
  await dataStorage.setItem(
    STORAGE_KEYS.CUSTOM_TOKEN_LIST,
    JSON.stringify(storage),
  );
};

export const useManageAssets = ({
  network,
  account,
  onSuccess,
}: UseManageAssetsProps): UseManageAssetsReturn => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isRemovingAsset, setIsRemovingAsset] = useState(false);

  if (!account) {
    return {
      addAsset: () => Promise.resolve(),
      removeAsset: () => Promise.resolve(),
      isAddingAsset: false,
      isRemovingAsset: false,
    };
  }

  const { publicKey, privateKey } = account;

  const addAsset = async (
    asset: FormattedSearchAssetRecord,
    onComplete?: () => void,
  ) => {
    if (!asset) {
      return;
    }

    setIsAddingAsset(true);

    const { assetCode, issuer } = asset;

    let toastOptions: ToastOptions = {
      title: t("addAssetScreen.toastSuccess", {
        assetCode,
      }),
      variant: "success",
    };

    try {
      if (asset.assetType === AssetTypeWithCustomToken.CUSTOM_TOKEN) {
        // Create new custom token entry
        const customToken: CustomToken = {
          contractId: asset.issuer,
          symbol: asset.assetCode,
          name: asset.name ?? asset.assetCode,
          decimals: asset.decimals ?? DEFAULT_DECIMALS,
        };

        // Get current storage
        const storage = await getCustomTokenStorage();

        // Initialize nested structure if needed
        if (!storage[publicKey]) {
          storage[publicKey] = {};
        }

        if (!storage[publicKey][network]) {
          storage[publicKey][network] = [];
        }

        // Add the new token
        storage[publicKey][network].push(customToken);

        // Save back to storage
        await saveCustomTokenStorage(storage);

        // Add visual delay for custom token addition
        await new Promise((resolve) => {
          setTimeout(resolve, VISUAL_DELAY_MS);
        });
      } else {
        // Handle regular asset trustline
        const addAssetTrustlineTx = await buildChangeTrustTx({
          assetIdentifier: `${assetCode}:${issuer}`,
          network,
          publicKey,
        });

        const signedTx = signTransaction({
          tx: addAssetTrustlineTx,
          secretKey: privateKey,
          network,
        });

        await submitTx({
          network,
          tx: signedTx,
        });
      }
      analytics.track(AnalyticsEvent.ADD_ASSET_SUCCESS, {
        asset: `${assetCode}:${issuer}`,
      });
    } catch (error) {
      analytics.track(AnalyticsEvent.ASSET_MANAGEMENT_FAIL, {
        error: error instanceof Error ? error.message : String(error),
        action: "add",
        asset: `${assetCode}:${issuer}`,
      });

      logger.error(
        "useManageAssets.addAsset",
        "Error adding asset trustline",
        error,
      );

      toastOptions = {
        title: t("addAssetScreen.toastError", {
          assetCode,
        }),
        variant: "error",
      };
    } finally {
      setIsAddingAsset(false);
      showToast(toastOptions);

      // Execute onComplete callback if provided
      onComplete?.();

      // Execute onSuccess callback after a slight delay to ensure modal is dismissed first
      setTimeout(() => {
        onSuccess?.();
      }, 100);
    }
  };

  const removeAsset = async (input: RemoveAssetParams) => {
    const { assetId, assetRecord, assetType, onComplete } = input;

    let assetCode: string;
    let assetIssuer: string;
    let assetIdentifier: string;

    if (assetId) {
      const formattedAsset = formatAssetIdentifier(assetId);
      assetCode = formattedAsset.assetCode;
      assetIssuer = formattedAsset.issuer;
      assetIdentifier = assetId;
    } else if (assetRecord) {
      assetCode = assetRecord.assetCode;
      assetIssuer = assetRecord.issuer;
      assetIdentifier = `${assetRecord.assetCode}:${assetRecord.issuer}`;
    } else {
      throw new Error("No asset ID or asset record provided");
    }

    setIsRemovingAsset(true);

    let toastOptions: ToastOptions = {
      title: t("manageAssetsScreen.removeAssetSuccess", {
        assetCode,
      }),
      variant: "success",
    };

    try {
      if (assetType === AssetTypeWithCustomToken.CUSTOM_TOKEN) {
        // Get current storage
        const storage = await getCustomTokenStorage();

        // Check if the user has any custom tokens for this network
        if (!storage[publicKey] || !storage[publicKey][network]) {
          return;
        }

        // Filter out the token to remove
        const tokens = storage[publicKey][network];
        const updatedTokens = tokens.filter(
          (token) =>
            token.contractId !== assetIssuer || token.symbol !== assetCode,
        );

        if (updatedTokens.length === 0) {
          // If no tokens left for this network, clean up
          delete storage[publicKey][network];

          // If no networks left for this public key, clean up
          if (Object.keys(storage[publicKey]).length === 0) {
            delete storage[publicKey];
          }
        } else {
          // Update with filtered tokens
          storage[publicKey][network] = updatedTokens;
        }

        // Save back to storage
        await saveCustomTokenStorage(storage);

        // Add visual delay for custom token removal
        await new Promise((resolve) => {
          setTimeout(resolve, VISUAL_DELAY_MS);
        });
      } else {
        // Handle regular asset trustline removal
        const removeAssetTrustlineTx = await buildChangeTrustTx({
          assetIdentifier,
          network,
          publicKey,
          isRemove: true,
        });

        const signedTx = signTransaction({
          tx: removeAssetTrustlineTx,
          secretKey: privateKey,
          network,
        });

        await submitTx({
          network,
          tx: signedTx,
        });
      }
      analytics.track(AnalyticsEvent.REMOVE_ASSET_SUCCESS, {
        asset: assetIdentifier,
      });
    } catch (error) {
      analytics.track(AnalyticsEvent.ASSET_MANAGEMENT_FAIL, {
        error: error instanceof Error ? error.message : String(error),
        action: "remove",
        asset: assetIdentifier,
      });

      logger.error(
        "useManageAssets.removeAsset",
        "Error removing asset",
        error,
      );
      toastOptions = {
        title: t("manageAssetsScreen.removeAssetError", {
          assetCode,
        }),
        variant: "error",
      };
    } finally {
      setIsRemovingAsset(false);
      showToast(toastOptions);

      // Execute onComplete callback if provided
      onComplete?.();

      // Execute onSuccess callback after a slight delay to ensure modal is dismissed first
      setTimeout(() => {
        onSuccess?.();
      }, 100);
    }
  };

  return {
    addAsset,
    removeAsset,
    isAddingAsset,
    isRemovingAsset,
  };
};
