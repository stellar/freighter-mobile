import BigNumber from "bignumber.js";
import CannotRemoveTokenBottomSheet, {
  CannotRemoveType,
} from "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { HeldBalanceItem } from "hooks/useBalancesList";
import React from "react";

interface RemoveTokenSheetContentProps {
  /** The balance row the user chose to remove, or null when none selected */
  selectedToken: HeldBalanceItem | null;
  /** Active account (used to render the removal confirmation details) */
  account: ActiveAccount | null;
  /** Called when the user cancels the removal */
  onCancel: () => void;
  /** Called when the user confirms the removal */
  onRemoveToken: () => Promise<void>;
  /** Whether a removal transaction is in flight */
  isRemovingToken: boolean;
  /** Dismisses the bottom sheet (used by the "cannot remove" variants) */
  onDismiss: () => void;
}

/**
 * RemoveTokenSheetContent
 *
 * Decides which bottom-sheet body to show when removing a token:
 * - XLM (native)                        -> CannotRemove (native)
 * - positive balance or LP-share token  -> CannotRemove (hasBalance)
 * - zero-balance non-native token       -> the removable confirmation content
 *
 * Extracted from the deleted SimpleBalancesList so Token Details owns a single
 * source of truth for the removability guard.
 */
export const RemoveTokenSheetContent: React.FC<
  RemoveTokenSheetContentProps
> = ({
  selectedToken,
  account,
  onCancel,
  onRemoveToken,
  isRemovingToken,
  onDismiss,
}) => {
  const isLpShare = selectedToken
    ? selectedToken.tokenType === TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES
    : false;

  const selectedTokenIssuer =
    selectedToken && "token" in selectedToken && "issuer" in selectedToken.token
      ? selectedToken.token.issuer.key
      : NATIVE_TOKEN_CODE;

  if (
    selectedToken &&
    selectedTokenIssuer === NATIVE_TOKEN_CODE &&
    !isLpShare
  ) {
    return (
      <CannotRemoveTokenBottomSheet
        type={CannotRemoveType.native}
        onDismiss={onDismiss}
      />
    );
  }

  const hasBalance = selectedToken
    ? selectedToken.total.isGreaterThan(new BigNumber(0))
    : false;

  if (hasBalance || isLpShare) {
    return (
      <CannotRemoveTokenBottomSheet
        type={CannotRemoveType.hasBalance}
        onDismiss={onDismiss}
      />
    );
  }

  if (selectedToken && selectedTokenIssuer) {
    return (
      <RemoveTokenBottomSheetContent
        token={{
          issuer: selectedTokenIssuer,
          tokenCode: selectedToken.tokenCode!,
          tokenType: selectedToken.tokenType,
        }}
        account={account}
        onCancel={onCancel}
        onRemoveToken={onRemoveToken}
        isRemovingToken={isRemovingToken}
      />
    );
  }

  return null;
};

export default RemoveTokenSheetContent;
