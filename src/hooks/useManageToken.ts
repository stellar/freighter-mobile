import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { useManageTokens } from "hooks/useManageTokens";
import { useCallback } from "react";
import { analytics } from "services/analytics";

/**
 * Represents token details for management operations
 * @property {string} [id] - Optional token identifier (usually code:issuer)
 * @property {string} code - Token code (e.g., "USDC", "BTC")
 * @property {number} [decimals] - Number of decimal places for the token
 * @property {TokenTypeWithCustomToken} [type] - Token type (native, credit, custom, etc.)
 * @property {string} [name] - Human-readable token name
 * @property {string} issuer - Token issuer public key
 * @property {string} [iconUrl] - Icon URL found during token search (used to cache immediately on Home Screen)
 */
type TokenDetails = {
  id?: string;
  code: string;
  decimals?: number;
  type?: TokenTypeWithCustomToken;
  name?: string;
  issuer: string;
  iconUrl?: string;
};

interface ManageTokenProps {
  account: ActiveAccount | null;
  bottomSheetRefAdd?: React.RefObject<BottomSheetModal | null>;
  bottomSheetRefRemove?: React.RefObject<BottomSheetModal | null>;
  network: NETWORKS;
  onSuccess?: () => void;
  token: TokenDetails | null;
}

export const useManageToken = ({
  account,
  bottomSheetRefAdd,
  bottomSheetRefRemove,
  network,
  onSuccess,
  token,
}: ManageTokenProps) => {
  const {
    addToken: addTokenAction,
    removeToken: removeTokenAction,
    isAddingToken,
    isRemovingToken,
  } = useManageTokens({
    network,
    account,
    onSuccess,
  });

  const addToken = useCallback(async () => {
    if (!token) {
      return;
    }
    const { code, decimals, issuer, name, type, iconUrl } = token;
    analytics.trackAddTokenConfirmed(token.code);

    if (iconUrl) {
      // Cache token icon immediately to prevent Home Screen fallback (initials)
      // This uses the icon found during the token search phase, avoiding the need
      // to wait for the background icon fetch process (which starts after a 5s delay)
      const identifier = `${code}:${issuer}`;

      useTokenIconsStore.getState().cacheTokenIcons({
        icons: {
          [identifier]: {
            imageUrl: iconUrl,
            network,
            isValidated: true,
            isValid: true,
          },
        },
      });
    }

    await addTokenAction({
      decimals,
      issuer,
      name,
      tokenCode: code,
      tokenType: type,
    });

    if (bottomSheetRefAdd) {
      bottomSheetRefAdd.current?.dismiss();
    }
  }, [token, addTokenAction, bottomSheetRefAdd, network]);

  const removeToken = useCallback(async () => {
    if (!token) {
      return;
    }
    const { id, type } = token;
    analytics.trackRemoveTokenConfirmed(token.code);

    await removeTokenAction({
      tokenId: id,
      tokenType: type,
    });

    if (bottomSheetRefRemove) {
      bottomSheetRefRemove.current?.dismiss();
    }
  }, [token, removeTokenAction, bottomSheetRefRemove]);

  return {
    addToken,
    isAddingToken,
    isRemovingToken,
    removeToken,
  };
};
