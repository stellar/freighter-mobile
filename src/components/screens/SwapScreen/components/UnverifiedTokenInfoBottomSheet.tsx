import { BottomSheetModal } from "@gorhom/bottom-sheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

export interface UnverifiedTokenInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const UnverifiedTokenInfoBottomSheet: React.FC<
  UnverifiedTokenInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();

  return (
    <InformationBottomSheet
      onClose={() => bottomSheetModalRef?.current?.dismiss()}
      headerElement={
        <Icon.CheckVerified02
          themeColor="gray"
          withBackground
          square
          size={28}
        />
      }
      title={t("swapScreen.unverifiedInfo.title")}
      texts={[{ key: "body", value: t("swapScreen.unverifiedInfo.body") }]}
    />
  );
};

export default UnverifiedTokenInfoBottomSheet;
