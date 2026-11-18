import BigNumber from "bignumber.js";
import { MINIMUM_CREATE_ACCOUNT_XLM } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { isContractDestination } from "helpers/muxedContract";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import {
  isUnfundedDestinationError,
  type UnfundedDestinationContext,
} from "services/blockaid/helper";

/**
 * Inputs needed to classify a send for the unfunded-destination warning.
 * Kept minimal so the helper can be exercised directly in unit tests
 * without standing up a full PricedBalance fixture.
 */
export interface BuildUnfundedContextParams {
  selectedBalance:
    | {
        tokenCode?: string;
        tokenType: TokenTypeWithCustomToken;
      }
    | undefined;
  isDestinationFunded: boolean | null;
  tokenAmount: BigNumber.Value;
  recipientAddress?: string;
}

/**
 * Builds the UnfundedDestinationContext that feeds the Blockaid
 * "expected to fail" check. Returns undefined while inputs aren't ready
 * (no balance selected, or destination funding status unknown).
 *
 * The `isClassicAsset` flag must be true whenever the send uses classic
 * Stellar account semantics — native XLM, credit_alphanum assets, AND
 * SAC-wrapped classic assets (a SAC's `transfer` still fails to an
 * unfunded G-account). Only pure Soroban custom tokens qualify as
 * non-classic; the wallet tags those with tokenType === CUSTOM_TOKEN at
 * import time (see backend.getTokenMetadata).
 *
 * The `isContractDestination` flag is true when the recipient is a
 * contract (`C…`) or muxed contract (`W…`) address. Contract destinations
 * never trigger the warning because their balances live in the token
 * contract's storage — there's no classic account to be "unfunded".
 */
export function buildUnfundedContext({
  selectedBalance,
  isDestinationFunded,
  tokenAmount,
  recipientAddress,
}: BuildUnfundedContextParams): UnfundedDestinationContext | undefined {
  if (!selectedBalance || isDestinationFunded === null) {
    return undefined;
  }

  const assetCode = selectedBalance.tokenCode || "unknown";
  // tokenType is derived from the balance's canonical identifier
  // (code:issuer).
  const isNativeAsset =
    selectedBalance.tokenType === TokenTypeWithCustomToken.NATIVE;
  const canCreateAccountWithAmount = isNativeAsset
    ? new BigNumber(tokenAmount).isGreaterThanOrEqualTo(
        MINIMUM_CREATE_ACCOUNT_XLM,
      )
    : undefined;

  const isClassicAsset =
    selectedBalance.tokenType !== TokenTypeWithCustomToken.CUSTOM_TOKEN;

  return {
    assetCode,
    isNativeAsset,
    isDestinationFunded,
    canCreateAccountWithAmount,
    isClassicAsset,
    isContractDestination: Boolean(
      recipientAddress && isContractDestination(recipientAddress),
    ),
  };
}

// Shared with Earn from services/blockaid/transactionSecurity; re-exported
// here for Send's existing imports.
export { getTransactionSecurity } from "services/blockaid/transactionSecurity";

export interface BannerContent {
  text: string;
  variant: "error" | "warning";
  onPress: () => void;
}

export interface UseSendBannerContentParams {
  isMalicious: boolean;
  isSuspicious: boolean;
  isExpectedToFail?: boolean;
  isUnableToScan?: boolean;
  isRequiredMemoMissing?: boolean;
  unfundedContext?: UnfundedDestinationContext;
  onSecurityWarningPress: () => void;
  onMemoMissingPress?: () => void;
}

/**
 * Hook for building banner content based on transaction security and memo requirements
 * Returns banner configuration with text, variant, and onPress handler
 */
export function useSendBannerContent({
  isMalicious,
  isSuspicious,
  isExpectedToFail = false,
  isUnableToScan = false,
  isRequiredMemoMissing = false,
  unfundedContext,
  onSecurityWarningPress,
  onMemoMissingPress,
}: UseSendBannerContentParams): BannerContent | undefined {
  const { t } = useAppTranslation();

  // Check if this is an unfunded destination error
  const isUnfundedDestination = useMemo(() => {
    if (!unfundedContext) {
      return false;
    }
    return isUnfundedDestinationError(unfundedContext);
  }, [unfundedContext]);

  return useMemo(() => {
    const shouldShowNoticeBanner =
      isRequiredMemoMissing ||
      isMalicious ||
      isSuspicious ||
      isExpectedToFail ||
      isUnfundedDestination ||
      isUnableToScan;

    if (!shouldShowNoticeBanner) {
      return undefined;
    }

    if (isMalicious) {
      return {
        text: t("transactionAmountScreen.errors.malicious"),
        variant: "error" as const,
        onPress: onSecurityWarningPress,
      };
    }

    if (isExpectedToFail || isUnfundedDestination) {
      return {
        text: t("blockaid.security.transaction.expectedToFail"),
        variant: "warning" as const,
        onPress: onSecurityWarningPress,
      };
    }

    if (isSuspicious) {
      return {
        text: t("transactionAmountScreen.errors.suspicious"),
        variant: "warning" as const,
        onPress: onSecurityWarningPress,
      };
    }

    if (isRequiredMemoMissing && onMemoMissingPress) {
      return {
        text: t("transactionAmountScreen.errors.memoMissing"),
        variant: "error" as const,
        onPress: onMemoMissingPress,
      };
    }

    if (isUnableToScan && onSecurityWarningPress) {
      return {
        text: t("securityWarning.proceedWithCaution"),
        variant: "warning" as const,
        onPress: onSecurityWarningPress,
      };
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRequiredMemoMissing,
    isMalicious,
    isSuspicious,
    isExpectedToFail,
    isUnableToScan,
    isUnfundedDestination,
    onSecurityWarningPress,
    onMemoMissingPress,
    t,
  ]);
}
