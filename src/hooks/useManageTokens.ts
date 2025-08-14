import { AnalyticsEvent } from "config/analyticsConfig";
import {
  DEFAULT_DECIMALS,
  NETWORKS,
  STORAGE_KEYS,
  VISUAL_DELAY_MS,
} from "config/constants";
import { logger } from "config/logger";
import {
  TokenTypeWithCustomToken,
  CustomToken,
  CustomTokenStorage,
  FormattedSearchTokenRecord,
} from "config/types";
import { ActiveAccount } from "ducks/auth";
import { formatTokenIdentifier } from "helpers/balances";
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

interface UseManageTokensProps {
  network: NETWORKS;
  account: ActiveAccount | null;
  onSuccess?: () => void;
}

interface UseManageTokensReturn {
  addToken: (
    token: FormattedSearchTokenRecord,
    onComplete?: () => void,
  ) => Promise<void>;
  removeToken: (input: RemoveTokenParams) => Promise<void>;
  isAddingToken: boolean;
  isRemovingToken: boolean;
}

export interface RemoveTokenParams {
  tokenId?: string;
  tokenRecord?: FormattedSearchTokenRecord;
  tokenType?: TokenTypeWithCustomToken;
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

export const useManageTokens = ({
  network,
  account,
  onSuccess,
}: UseManageTokensProps): UseManageTokensReturn => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [isRemovingToken, setIsRemovingToken] = useState(false);

  if (!account) {
    return {
      addToken: () => Promise.resolve(),
      removeToken: () => Promise.resolve(),
      isAddingToken: false,
      isRemovingToken: false,
    };
  }

  const { publicKey, privateKey } = account;

  const addToken = async (
    token: FormattedSearchTokenRecord,
    onComplete?: () => void,
  ) => {
    if (!token) {
      return;
    }

    setIsAddingToken(true);

    const { tokenCode, issuer } = token;

    let toastOptions: ToastOptions = {
      title: t("addTokenScreen.toastSuccess", {
        tokenCode,
      }),
      variant: "success",
    };

    try {
      if (token.tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN) {
        // Create new custom token entry
        const customToken: CustomToken = {
          contractId: token.issuer,
          symbol: token.tokenCode,
          name: token.name ?? token.tokenCode,
          decimals: token.decimals ?? DEFAULT_DECIMALS,
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
        // Handle regular token trustline
        const addTokenTrustlineTx = await buildChangeTrustTx({
          tokenIdentifier: `${tokenCode}:${issuer}`,
          network,
          publicKey,
        });

        const signedTx = signTransaction({
          tx: addTokenTrustlineTx,
          secretKey: privateKey,
          network,
        });

        await submitTx({
          network,
          tx: signedTx,
        });
      }
      analytics.track(AnalyticsEvent.ADD_TOKEN_SUCCESS, {
        token: `${tokenCode}:${issuer}`,
      });
    } catch (error) {
      analytics.track(AnalyticsEvent.TOKEN_MANAGEMENT_FAIL, {
        error: error instanceof Error ? error.message : String(error),
        action: "add",
        token: `${tokenCode}:${issuer}`,
      });

      logger.error(
        "useManageTokens.addToken",
        "Error adding token trustline",
        error,
      );

      toastOptions = {
        title: t("addTokenScreen.toastError", {
          tokenCode,
        }),
        variant: "error",
      };
    } finally {
      setIsAddingToken(false);
      showToast(toastOptions);

      // Execute onComplete callback if provided
      onComplete?.();

      // Execute onSuccess callback after a slight delay to ensure modal is dismissed first
      setTimeout(() => {
        onSuccess?.();
      }, 100);
    }
  };

  const removeToken = async (input: RemoveTokenParams) => {
    const { tokenId, tokenRecord, tokenType, onComplete } = input;

    let tokenCode: string;
    let tokenIssuer: string;
    let tokenIdentifier: string;

    if (tokenId) {
      const formattedToken = formatTokenIdentifier(tokenId);
      tokenCode = formattedToken.tokenCode;
      tokenIssuer = formattedToken.issuer;
      tokenIdentifier = tokenId;
    } else if (tokenRecord) {
      tokenCode = tokenRecord.tokenCode;
      tokenIssuer = tokenRecord.issuer;
      tokenIdentifier = `${tokenRecord.tokenCode}:${tokenRecord.issuer}`;
    } else {
      throw new Error("No token ID or token record provided");
    }

    setIsRemovingToken(true);

    let toastOptions: ToastOptions = {
      title: t("manageTokensScreen.removeTokenSuccess", {
        tokenCode,
      }),
      variant: "success",
    };

    try {
      if (tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN) {
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
            token.contractId !== tokenIssuer || token.symbol !== tokenCode,
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
        // Handle regular token trustline removal
        const removeTokenTrustlineTx = await buildChangeTrustTx({
          tokenIdentifier,
          network,
          publicKey,
          isRemove: true,
        });

        const signedTx = signTransaction({
          tx: removeTokenTrustlineTx,
          secretKey: privateKey,
          network,
        });

        await submitTx({
          network,
          tx: signedTx,
        });
      }
      analytics.track(AnalyticsEvent.REMOVE_TOKEN_SUCCESS, {
        token: tokenIdentifier,
      });
    } catch (error) {
      analytics.track(AnalyticsEvent.TOKEN_MANAGEMENT_FAIL, {
        error: error instanceof Error ? error.message : String(error),
        action: "remove",
        token: tokenIdentifier,
      });

      logger.error(
        "useManageTokens.removeToken",
        "Error removing token",
        error,
      );
      toastOptions = {
        title: t("manageTokensScreen.removeTokenError", {
          tokenCode,
        }),
        variant: "error",
      };
    } finally {
      setIsRemovingToken(false);
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
    addToken,
    removeToken,
    isAddingToken,
    isRemovingToken,
  };
};
