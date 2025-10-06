import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useRef } from "react";
import { TouchableOpacity } from "react-native";

interface SignTransactionDetailsProps {
  analyticsEvent?: AnalyticsEvent;
  data: SignTransactionDetailsInterface;
}

const SignTransactionDetails: React.FC<SignTransactionDetailsProps> = ({
  analyticsEvent,
  data,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const signTransactionDetailsBottomSheetModalRef =
    useRef<BottomSheetModal>(null);

  const handleOpenTransactionDetails = () => {
    signTransactionDetailsBottomSheetModalRef.current?.present();
  };

  const handleDismiss = () => {
    signTransactionDetailsBottomSheetModalRef.current?.dismiss();
  };

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
        onPress={handleOpenTransactionDetails}
      >
        <Icon.List size={16} themeColor="lilac" />
        <Text color={themeColors.lilac[11]}>
          {t("dappRequestBottomSheetContent.transactionDetails")}
        </Text>
      </TouchableOpacity>

      <BottomSheet
        modalRef={signTransactionDetailsBottomSheetModalRef}
        handleCloseModal={() =>
          signTransactionDetailsBottomSheetModalRef.current?.dismiss()
        }
        enableDynamicSizing={false}
        useInsetsBottomPadding={false}
        enablePanDownToClose={false}
        analyticsEvent={analyticsEvent}
        snapPoints={["90%"]}
        customContent={
          <SignTransactionDetailsBottomSheet
            data={data}
            onDismiss={handleDismiss}
          />
        }
      />
    </>
  );
};

export default SignTransactionDetails;
