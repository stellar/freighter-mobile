import { Banner } from "components/sds/Banner";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useMemo } from "react";

interface DappRequestBannersProps {
  isMemoMissing?: boolean;
  onBannerPress?: () => void;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  securityWarningAction?: () => void;
}

export const DappRequestBanners: React.FC<DappRequestBannersProps> = ({
  isMemoMissing,
  onBannerPress,
  isMalicious,
  isSuspicious,
  isUnableToScan,
  securityWarningAction,
}) => {
  const { t } = useAppTranslation();

  const securityBannerText = useMemo(() => {
    if (isMalicious) return t("dappConnectionBottomSheetContent.maliciousFlag");
    if (isSuspicious)
      return t("dappConnectionBottomSheetContent.suspiciousFlag");
    if (isUnableToScan) return t("securityWarning.proceedWithCaution");
    return "";
  }, [isMalicious, isSuspicious, isUnableToScan, t]);

  const securityBannerVariant = isMalicious
    ? ("error" as const)
    : ("warning" as const);

  return (
    <>
      {isMemoMissing && !securityBannerText && (
        <Banner
          variant="error"
          text={t("transactionAmountScreen.errors.memoMissing")}
          onPress={onBannerPress}
        />
      )}
      {(isMalicious || isSuspicious || isUnableToScan) && (
        <Banner
          variant={securityBannerVariant}
          text={securityBannerText}
          onPress={securityWarningAction}
        />
      )}
    </>
  );
};
