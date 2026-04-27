import Blockaid from "@blockaid/client";
import BigNumber from "bignumber.js";
import {
  MINIMUM_CREATE_ACCOUNT_XLM,
  NATIVE_TOKEN_CODE,
} from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
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
 * contract (C...) address. Contract destinations never trigger the
 * warning because their balances live in the token contract's storage —
 * there's no classic account to be "unfunded".
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
  const canCreateAccountWithAmount =
    assetCode === NATIVE_TOKEN_CODE
      ? new BigNumber(tokenAmount).isGreaterThanOrEqualTo(
          MINIMUM_CREATE_ACCOUNT_XLM,
        )
      : undefined;

  const isClassicAsset =
    selectedBalance.tokenType !== TokenTypeWithCustomToken.CUSTOM_TOKEN;

  const isContractDestination = Boolean(
    recipientAddress && isContractId(recipientAddress),
  );

  return {
    assetCode,
    isDestinationFunded,
    canCreateAccountWithAmount,
    isClassicAsset,
    isContractDestination,
  };
}

function getTransactionSecurityWarnings(
  assessment: ReturnType<typeof assessTransactionSecurity>,
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
  unfundedContext?: UnfundedDestinationContext,
) {
  if (assessment.isUnableToScan) {
    return [
      {
        id: "unable-to-scan",
        description: assessment.details || "Unable to scan transaction",
      },
    ];
  }

  if (
    assessment.isMalicious ||
    assessment.isSuspicious ||
    assessment.isExpectedToFail
  ) {
    const warnings = extractSecurityWarnings(scanResult, unfundedContext);

    if (Array.isArray(warnings) && warnings.length > 0) {
      return warnings;
    }
  }

  return [];
}

function getTransactionSecuritySeverity(
  assessment: ReturnType<typeof assessTransactionSecurity>,
): Exclude<SecurityLevel, SecurityLevel.SAFE> | undefined {
  if (assessment.isExpectedToFail) return SecurityLevel.EXPECTED_TO_FAIL;
  if (assessment.isMalicious) return SecurityLevel.MALICIOUS;
  if (assessment.isSuspicious) return SecurityLevel.SUSPICIOUS;
  if (assessment.isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;

  return undefined;
}

/**
 * Function for getting transaction security assessment
 * Can be called at runtime with scanResult as parameter
 *
 * @param scanResult - The Blockaid scan result
 * @param overriddenBlockaidResponse - Optional override for debugging
 * @param unfundedContext - Optional context for unfunded destination detection
 */
export function getTransactionSecurity(
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
  overriddenBlockaidResponse?: SecurityLevel | null,
  unfundedContext?: UnfundedDestinationContext,
) {
  const transactionSecurityAssessment = assessTransactionSecurity(
    scanResult,
    overriddenBlockaidResponse,
    unfundedContext,
  );

  const transactionSecurityWarnings = getTransactionSecurityWarnings(
    transactionSecurityAssessment,
    scanResult,
    unfundedContext,
  );

  const transactionSecuritySeverity = getTransactionSecuritySeverity(
    transactionSecurityAssessment,
  );

  return {
    transactionSecurityAssessment,
    transactionSecurityWarnings,
    transactionSecuritySeverity,
  };
}

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
  isMuxedAddressWithoutMemoSupport?: boolean;
  unfundedContext?: UnfundedDestinationContext;
  onSecurityWarningPress: () => void;
  onMemoMissingPress?: () => void;
  onMuxedAddressWithoutMemoSupportPress?: () => void;
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
  isMuxedAddressWithoutMemoSupport = false,
  unfundedContext,
  onSecurityWarningPress,
  onMemoMissingPress,
  onMuxedAddressWithoutMemoSupportPress,
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
      isMuxedAddressWithoutMemoSupport ||
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

    if (
      isMuxedAddressWithoutMemoSupport &&
      onMuxedAddressWithoutMemoSupportPress
    ) {
      return {
        text: t("transactionAmountScreen.errors.muxedAddressNotSupported"),
        variant: "error" as const,
        onPress: onMuxedAddressWithoutMemoSupportPress,
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
    isMuxedAddressWithoutMemoSupport,
    isUnableToScan,
    isUnfundedDestination,
    onSecurityWarningPress,
    onMemoMissingPress,
    onMuxedAddressWithoutMemoSupportPress,
    t,
  ]);
}
