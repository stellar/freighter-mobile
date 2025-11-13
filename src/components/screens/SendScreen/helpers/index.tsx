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
) {
  const transactionSecurityAssessment = useMemo(
    () => assessTransactionSecurity(transactionScanResult),
    [transactionScanResult],
  );

  const transactionSecurityWarnings = useMemo(() => {
    if (
      transactionSecurityAssessment.isMalicious ||
      transactionSecurityAssessment.isSuspicious
    ) {
      const warnings = extractSecurityWarnings(transactionScanResult);

      if (warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
    transactionScanResult,
  ]);

  const transactionSecuritySeverity:
    | Exclude<SecurityLevel, SecurityLevel.SAFE>
    | undefined = useMemo(() => {
    if (transactionSecurityAssessment.isMalicious)
      return SecurityLevel.MALICIOUS;
    if (transactionSecurityAssessment.isSuspicious)
      return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [
    transactionSecurityAssessment.isMalicious,
    transactionSecurityAssessment.isSuspicious,
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
  isRequiredMemoMissing?: boolean;
  isMuxedAddressWithoutMemoSupport?: boolean;
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
  isRequiredMemoMissing = false,
  isMuxedAddressWithoutMemoSupport = false,
  onSecurityWarningPress,
  onMemoMissingPress,
  onMuxedAddressWithoutMemoSupportPress,
}: UseSendBannerContentParams): BannerContent | undefined {
  const { t } = useAppTranslation();

  return useMemo(() => {
    const shouldShowNoticeBanner =
      isRequiredMemoMissing ||
      isMalicious ||
      isSuspicious ||
      isMuxedAddressWithoutMemoSupport;

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

    return undefined;
  }, [
    isRequiredMemoMissing,
    isMalicious,
    isSuspicious,
    isMuxedAddressWithoutMemoSupport,
    t,
    onSecurityWarningPress,
    onMemoMissingPress,
    onMuxedAddressWithoutMemoSupportPress,
  ]);
}
