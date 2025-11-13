import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useManageTokens } from "hooks/useManageTokens";
import { useCallback } from "react";
import { analytics } from "services/analytics";

type TokenDetails = {
  id?: string;
  code: string;
  decimals?: number;
  type?: TokenTypeWithCustomToken;
  name?: string;
  issuer: string;
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
    const { code, decimals, issuer, name, type } = token;
    analytics.trackAddTokenConfirmed(token.code);

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
  }, [token, addTokenAction, bottomSheetRefAdd]);

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
