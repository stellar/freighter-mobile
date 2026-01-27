import Blockaid from "@blockaid/client";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
  isUnfundedDestinationError,
  UnfundedDestinationContext,
} from "services/blockaid/helper";

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
  scanResult?: Blockaid.StellarTransactionScanResponse;
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
  scanResult,
  unfundedContext,
  onSecurityWarningPress,
  onMemoMissingPress,
  onMuxedAddressWithoutMemoSupportPress,
}: UseSendBannerContentParams): BannerContent | undefined {
  const { t } = useAppTranslation();

  // Check if this is an unfunded destination error
  const isUnfundedDestination = useMemo(() => {
    if (!scanResult) {
      return false;
    }
    return isUnfundedDestinationError(scanResult, unfundedContext);
  }, [scanResult, unfundedContext]);

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
