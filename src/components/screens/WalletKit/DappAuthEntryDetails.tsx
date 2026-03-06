import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappAuthEntryDetailsBottomSheet from "components/screens/WalletKit/DappAuthEntryDetailsBottomSheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useRef } from "react";
import { TouchableOpacity } from "react-native";

interface DappAuthEntryDetailsProps {
  entryXdr: string;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  securityWarningAction?: () => void;
}

const DappAuthEntryDetails: React.FC<DappAuthEntryDetailsProps> = ({
  entryXdr,
  isMalicious,
  isSuspicious,
  isUnableToScan,
  securityWarningAction,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const modalRef = useRef<BottomSheetModal>(null);

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
        onPress={() => modalRef.current?.present()}
        testID="dapp-auth-entry-details-button"
      >
        <Icon.List size={16} themeColor="lilac" />
        <Text color={themeColors.lilac[11]}>
          {t("dappRequestBottomSheetContent.transactionDetails")}
        </Text>
      </TouchableOpacity>

      <BottomSheet
        modalRef={modalRef}
        handleCloseModal={() => modalRef.current?.dismiss()}
        enableDynamicSizing={false}
        useInsetsBottomPadding={false}
        enablePanDownToClose={false}
        analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS}
        snapPoints={["90%"]}
        customContent={
          <DappAuthEntryDetailsBottomSheet
            entryXdr={entryXdr}
            isMalicious={isMalicious}
            isSuspicious={isSuspicious}
            isUnableToScan={isUnableToScan}
            securityWarningAction={securityWarningAction}
            onDismiss={() => modalRef.current?.dismiss()}
          />
        }
      />
    </>
  );
};

export default DappAuthEntryDetails;
