import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import FeeBreakdownBottomSheet from "components/FeeBreakdownBottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";

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
  const { themeColors } = useColors();
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
        handleCloseModal={() => breakdownSheetRef.current?.dismiss()}
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
        handleCloseModal={() => infoSheetRef.current?.dismiss()}
        customContent={
          <InformationBottomSheet
            title={t("transactionSettings.feeInfo.title")}
            onClose={() => infoSheetRef.current?.dismiss()}
            headerElement={
              <View className="bg-lilac-3 p-2 rounded-[8px]">
                <Icon.Route color={themeColors.lilac[9]} size={28} />
              </View>
            }
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
