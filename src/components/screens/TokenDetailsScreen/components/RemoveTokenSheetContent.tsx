import BigNumber from "bignumber.js";
import CannotRemoveTokenBottomSheet, {
  CannotRemoveType,
} from "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { isNativeBalance } from "helpers/assetIdentity";
import { HeldBalanceItem } from "hooks/useBalancesList";
import React from "react";

/** The body the removal sheet shows for the selected balance row. */
export enum RemoveTokenSheetVariant {
  /** No row is selected, so the sheet shows nothing. */
  none = "none",
  /** XLM cannot be removed. */
  cannotRemoveNative = "cannotRemoveNative",
  /** The token still holds a balance, or is a liquidity-pool share. */
  cannotRemoveHasBalance = "cannotRemoveHasBalance",
  /** The backend reports this contract token, so removal would not hold. */
  cannotRemoveNotLocallyAdded = "cannotRemoveNotLocallyAdded",
  /** The user can confirm the removal. */
  confirm = "confirm",
}

const CANNOT_REMOVE_TYPE: Partial<
  Record<RemoveTokenSheetVariant, CannotRemoveType>
> = {
  [RemoveTokenSheetVariant.cannotRemoveNative]: CannotRemoveType.native,
  [RemoveTokenSheetVariant.cannotRemoveHasBalance]: CannotRemoveType.hasBalance,
  [RemoveTokenSheetVariant.cannotRemoveNotLocallyAdded]:
    CannotRemoveType.notLocallyAdded,
};

const getSelectedTokenIssuer = (selectedToken: HeldBalanceItem): string =>
  "token" in selectedToken && "issuer" in selectedToken.token
    ? selectedToken.token.issuer.key
    : NATIVE_TOKEN_CODE;

interface RemoveTokenSheetContentProps {
  /** The balance row the user chose to remove, or null when none selected */
  selectedToken: HeldBalanceItem | null;
  /**
   * Contract IDs that are in the balances list only because the user saved them
   * locally — the only contract tokens removal can actually take off the list.
   */
  localOnlyTokenIds: string[];
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
 * Reports which body the removal sheet shows for a balance row.
 *
 * The sheet either offers the removal confirmation or explains why the wallet
 * cannot remove the token. Callers that must know the outcome of the prompt
 * use this function, so the prompt and the report always agree.
 */
export const getRemoveTokenSheetVariant = (
  selectedToken: HeldBalanceItem | null,
  localOnlyTokenIds: string[],
): RemoveTokenSheetVariant => {
  if (!selectedToken) {
    return RemoveTokenSheetVariant.none;
  }

  const isLpShare =
    selectedToken.tokenType === TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES;

  if (isNativeBalance(selectedToken) && !isLpShare) {
    return RemoveTokenSheetVariant.cannotRemoveNative;
  }

  if (selectedToken.total.isGreaterThan(new BigNumber(0)) || isLpShare) {
    return RemoveTokenSheetVariant.cannotRemoveHasBalance;
  }

  // Removing a contract token only drops it from the local custom-token list,
  // so it works only for tokens that are on screen *because* of that list. One
  // the backend reports on its own would come straight back on the next poll;
  // that case is hide-only. Classic trustlines are unaffected — removing those
  // is a real changeTrust operation.
  if (
    selectedToken.tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN &&
    !localOnlyTokenIds.includes(getSelectedTokenIssuer(selectedToken))
  ) {
    return RemoveTokenSheetVariant.cannotRemoveNotLocallyAdded;
  }

  return RemoveTokenSheetVariant.confirm;
};

/**
 * RemoveTokenSheetContent
 *
 * Decides which bottom-sheet body to show when removing a token:
 * - XLM (native)                        -> CannotRemove (native)
 * - positive balance or LP-share token  -> CannotRemove (hasBalance)
 * - backend-reported contract token     -> CannotRemove (notLocallyAdded)
 * - zero-balance non-native token       -> the removable confirmation content
 *
 * Extracted from the deleted SimpleBalancesList so Token Details owns a single
 * source of truth for the removability guard.
 */
export const RemoveTokenSheetContent: React.FC<
  RemoveTokenSheetContentProps
> = ({
  selectedToken,
  localOnlyTokenIds,
  account,
  onCancel,
  onRemoveToken,
  isRemovingToken,
  onDismiss,
}) => {
  const selectedTokenIssuer = selectedToken
    ? getSelectedTokenIssuer(selectedToken)
    : NATIVE_TOKEN_CODE;

  const variant = getRemoveTokenSheetVariant(selectedToken, localOnlyTokenIds);

  if (variant !== RemoveTokenSheetVariant.confirm) {
    const cannotRemoveType = CANNOT_REMOVE_TYPE[variant];

    if (!cannotRemoveType) {
      return null;
    }

    return (
      <CannotRemoveTokenBottomSheet
        type={cannotRemoveType}
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
