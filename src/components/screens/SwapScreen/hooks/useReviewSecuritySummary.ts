import Blockaid from "@blockaid/client";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { isNativeAssetId } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";
import {
  assessTokenSecurity,
  assessTransactionSecurity,
} from "services/blockaid/helper";

/**
 * Derives the Blockaid-based security flags and banner text used by the swap review sheet.
 */
export const useReviewSecuritySummary = ({
  transactionScanResult,
  sourceTokenScanResult,
  destTokenScanResult,
  overriddenBlockaidResponse,
  sourceTokenId,
  destinationTokenDescriptor,
}: {
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
  sourceTokenScanResult: Blockaid.TokenBulkScanResponse.Results | undefined;
  destTokenScanResult: Blockaid.TokenBulkScanResponse.Results | undefined;
  overriddenBlockaidResponse: Parameters<typeof assessTokenSecurity>[1];
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

  const transactionSecurityAssessment = assessTransactionSecurity(
    transactionScanResult,
    overriddenBlockaidResponse,
  );
  const sourceSecurityAssessment = assessTokenSecurity(
    sourceTokenScanResult,
    overriddenBlockaidResponse,
  );
  const destSecurityAssessment = assessTokenSecurity(
    destTokenScanResult,
    overriddenBlockaidResponse,
  );

  const { isMalicious: isTxMalicious, isSuspicious: isTxSuspicious } =
    transactionSecurityAssessment;
  const { isMalicious: isSourceMalicious, isSuspicious: isSourceSuspicious } =
    sourceSecurityAssessment;
  const { isMalicious: isDestMalicious, isSuspicious: isDestSuspicious } =
    destSecurityAssessment;

  const isMalicious = isTxMalicious || isSourceMalicious || isDestMalicious;
  const isSuspicious = isTxSuspicious || isSourceSuspicious || isDestSuspicious;
  // Native XLM is unscannable by definition — don't trip the warning
  // when the scan failed against it.
  const isUnableToScanToken =
    (sourceSecurityAssessment.isUnableToScan &&
      !isNativeAssetId(sourceTokenId ?? "")) ||
    (destSecurityAssessment.isUnableToScan &&
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
