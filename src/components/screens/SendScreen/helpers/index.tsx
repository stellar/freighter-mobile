import Blockaid from "@blockaid/client";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessTransactionSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

/**
 * Hook for managing transaction security assessment
 * Extracts security warnings and determines severity level
 */
export function useTransactionSecurity(
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined,
  overriddenBlockaidResponse?: SecurityLevel | null,
) {
  const transactionSecurityAssessment = useMemo(
    () =>
      assessTransactionSecurity(
        transactionScanResult,
        overriddenBlockaidResponse,
      ),
    [transactionScanResult, overriddenBlockaidResponse],
  );

  const transactionSecurityWarnings = useMemo(() => {
    if (transactionSecurityAssessment.isUnableToScan) {
      // For "Unable to scan" cases, always provide a warning so the list renders
      return [
        {
          id: "unable-to-scan",
          description:
            transactionSecurityAssessment.details ||
            "Unable to scan transaction",
        },
      ];
    }

    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious
    ) {
      const warnings = extractSecurityWarnings(transactionScanResult);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionSecurityAssessment.isUnableToScan,
    transactionSecurityAssessment.details,
    transactionScanResult,
  ]);

  const transactionSecuritySeverity:
    | Exclude<SecurityLevel, SecurityLevel.SAFE>
    | undefined = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;
    if (transactionSecurityAssessment.isUnableToScan)
      return SecurityLevel.UNABLE_TO_SCAN;

    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionSecurityAssessment.isUnableToScan,
  ]);

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
