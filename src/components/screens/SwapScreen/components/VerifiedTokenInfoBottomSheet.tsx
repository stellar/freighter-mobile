import { BottomSheetModal } from "@gorhom/bottom-sheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

export interface VerifiedTokenInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const VerifiedTokenInfoBottomSheet: React.FC<
  VerifiedTokenInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();

  return (
    <InformationBottomSheet
      onClose={() => bottomSheetModalRef?.current?.dismiss()}
      headerElement={
        <Icon.CheckVerified02
          themeColor="lilac"
          withBackground
          square
          size={28}
        />
      }
      title={t("swapScreen.verifiedInfo.title")}
      texts={[{ key: "body", value: t("swapScreen.verifiedInfo.body") }]}
    />
  );
};

export default VerifiedTokenInfoBottomSheet;
