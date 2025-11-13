import Blockaid from "@blockaid/client";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

function getTransactionSecurityWarnings(
  assessment: ReturnType<typeof assessTransactionSecurity>,
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
) {
  if (assessment.isUnableToScan) {
    return [
      {
        id: "unable-to-scan",
        description: assessment.details || "Unable to scan transaction",
      },
    ];
  }

  if (assessment.isMalicious || assessment.isSuspicious) {
    const warnings = extractSecurityWarnings(scanResult);

    if (Array.isArray(warnings) && warnings.length > 0) {
      return warnings;
    }
  }

  return [];
}

function getTransactionSecuritySeverity(
  assessment: ReturnType<typeof assessTransactionSecurity>,
): Exclude<SecurityLevel, SecurityLevel.SAFE> | undefined {
  if (assessment.isMalicious) return SecurityLevel.MALICIOUS;
  if (assessment.isSuspicious) return SecurityLevel.SUSPICIOUS;
  if (assessment.isUnableToScan) return SecurityLevel.UNABLE_TO_SCAN;

  return undefined;
}

/**
 * Function for getting transaction security assessment
 * Can be called at runtime with scanResult as parameter
 */
export function getTransactionSecurity(
  scanResult: Blockaid.StellarTransactionScanResponse | undefined,
  overriddenBlockaidResponse?: SecurityLevel | null,
) {
  const transactionSecurityAssessment = assessTransactionSecurity(
    scanResult,
    overriddenBlockaidResponse,
  );

  const transactionSecurityWarnings = getTransactionSecurityWarnings(
    transactionSecurityAssessment,
    scanResult,
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
  isUnableToScan?: boolean;
  isRequiredMemoMissing?: boolean;
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
  isUnableToScan = false,
  isRequiredMemoMissing = false,
  onSecurityWarningPress,
  onMemoMissingPress,
}: UseSendBannerContentParams): BannerContent | undefined {
  const { t } = useAppTranslation();

  return useMemo(() => {
    const shouldShowNoticeBanner =
      isRequiredMemoMissing || isMalicious || isSuspicious || isUnableToScan;

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

    if (isSuspicious) {
      return {
        text: t("transactionAmountScreen.errors.suspicious"),
        variant: "warning" as const,
        onPress: onSecurityWarningPress,
      };
    }

    if (isUnableToScan) {
      return {
        text: t("securityWarning.proceedWithCaution"),
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

    return undefined;
  }, [
    isRequiredMemoMissing,
    isMalicious,
    isSuspicious,
    isUnableToScan,
    t,
    onSecurityWarningPress,
    onMemoMissingPress,
  ]);
}
