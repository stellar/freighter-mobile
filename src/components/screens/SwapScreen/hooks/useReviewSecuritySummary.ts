import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { isNativeAssetId } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import type { SecurityAssessment } from "services/blockaid/types";

/**
 * Derives the banner copy + cross-side flags the swap review sheet renders,
 * given the three pre-computed Blockaid assessments owned by
 * `useSwapSecurityAssessments`. No scan-object re-assessment here — the
 * caller has already mapped each side to its assessment, including the
 * non-held-destination case (which uses the descriptor's `securityLevel`
 * directly rather than synthesising a fake scan).
 */
export const useReviewSecuritySummary = ({
  transactionSecurityAssessment,
  sourceSecurityAssessment,
  destinationSecurityAssessment,
  sourceTokenId,
  destinationTokenDescriptor,
}: {
  transactionSecurityAssessment: SecurityAssessment;
  sourceSecurityAssessment: SecurityAssessment;
  destinationSecurityAssessment: SecurityAssessment;
  sourceTokenId: string | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
}): {
  isMalicious: boolean;
  isSuspicious: boolean;
  isUnableToScanToken: boolean;
  isSourceMalicious: boolean;
  isSourceSuspicious: boolean;
  isDestMalicious: boolean;
  isDestSuspicious: boolean;
  bannerText: string;
} => {
  const { t } = useAppTranslation();

  const { isMalicious: isTxMalicious, isSuspicious: isTxSuspicious } =
    transactionSecurityAssessment;
  const { isMalicious: isSourceMalicious, isSuspicious: isSourceSuspicious } =
    sourceSecurityAssessment;
  const { isMalicious: isDestMalicious, isSuspicious: isDestSuspicious } =
    destinationSecurityAssessment;

  const isMalicious = isTxMalicious || isSourceMalicious || isDestMalicious;
  const isSuspicious = isTxSuspicious || isSourceSuspicious || isDestSuspicious;
  // Native XLM is unscannable by definition — don't trip the warning
  // when the scan failed against it.
  const isUnableToScanToken =
    (sourceSecurityAssessment.isUnableToScan &&
      !isNativeAssetId(sourceTokenId ?? "")) ||
    (destinationSecurityAssessment.isUnableToScan &&
      !isNativeAssetId(destinationTokenDescriptor?.id ?? ""));

  const bannerText = useMemo(() => {
    if (isTxMalicious) {
      return t("transactionAmountScreen.errors.malicious");
    }
    if (isTxSuspicious) {
      return t("transactionAmountScreen.errors.suspicious");
    }
    if (isDestMalicious || isSourceMalicious) {
      return t("transactionAmountScreen.errors.maliciousAsset");
    }
    if (isDestSuspicious || isSourceSuspicious) {
      return t("transactionAmountScreen.errors.suspiciousAsset");
    }
    if (isUnableToScanToken) {
      return t("securityWarning.proceedWithCaution");
    }
    return t("transactionAmountScreen.errors.malicious");
  }, [
    t,
    isTxMalicious,
    isTxSuspicious,
    isDestMalicious,
    isSourceMalicious,
    isDestSuspicious,
    isSourceSuspicious,
    isUnableToScanToken,
  ]);

  return {
    isMalicious,
    isSuspicious,
    isUnableToScanToken,
    isSourceMalicious,
    isSourceSuspicious,
    isDestMalicious,
    isDestSuspicious,
    bannerText,
  };
};
