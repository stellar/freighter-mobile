import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import FeeBreakdownBottomSheet from "components/FeeBreakdownBottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useRef } from "react";

/**
 * Shared fee info-icon affordance: Soroban opens the breakdown, classic opens a
 * fee info sheet. Returns `openFeeDetails` (the icon's onPress) and
 * `feeDetailsSheets` (render once). `inclusionFeeXlmOverride` previews an unsaved
 * fee in the breakdown.
 */
export const useFeeDetailsBottomSheet = ({
  isSorobanContext,
  inclusionFeeXlmOverride,
}: {
  isSorobanContext: boolean;
  inclusionFeeXlmOverride?: string;
}): {
  openFeeDetails: () => void;
  feeDetailsSheets: React.ReactNode;
} => {
  const { t } = useAppTranslation();
  const breakdownSheetRef = useRef<BottomSheetModal>(null);
  const infoSheetRef = useRef<BottomSheetModal>(null);

  const openFeeDetails = useCallback(() => {
    if (isSorobanContext) {
      breakdownSheetRef.current?.present();
    } else {
      infoSheetRef.current?.present();
    }
  }, [isSorobanContext]);

  const feeDetailsSheets = (
    <>
      <BottomSheet
        modalRef={breakdownSheetRef}
        customContent={
          <FeeBreakdownBottomSheet
            onClose={() => breakdownSheetRef.current?.dismiss()}
            isSorobanContext={isSorobanContext}
            inclusionFeeXlmOverride={inclusionFeeXlmOverride}
          />
        }
      />
      <BottomSheet
        modalRef={infoSheetRef}
        customContent={
          <InformationBottomSheet
            title={t("transactionSettings.feeInfo.title")}
            onClose={() => infoSheetRef.current?.dismiss()}
            texts={[
              {
                key: "description",
                value: t("transactionSettings.feeInfo.description"),
              },
              {
                key: "additionalInfo",
                value: t("transactionSettings.feeInfo.additionalInfo"),
              },
            ]}
          />
        }
      />
    </>
  );

  return { openFeeDetails, feeDetailsSheets };
};
