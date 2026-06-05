import { BottomSheetModal } from "@gorhom/bottom-sheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

export interface UnverifiedTokenInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const UnverifiedTokenInfoBottomSheet: React.FC<
  UnverifiedTokenInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <InformationBottomSheet
      onClose={() => bottomSheetModalRef?.current?.dismiss()}
      headerElement={
        // `Icon.CheckVerified02.themeColor` doesn't support `gray`, so the
        // unverified badge is hand-built: same square dimensions as the
        // lilac variant from VerifiedTokenInfoBottomSheet but with a
        // gray-3 fill, gray-6 border, and gray-9 icon stroke.
        <View className="size-10 rounded-lg items-center justify-center bg-gray-3 border border-gray-6">
          <Icon.CheckVerified02 color={themeColors.gray[9]} />
        </View>
      }
      title={t("swapScreen.unverifiedInfo.title")}
      texts={[{ key: "body", value: t("swapScreen.unverifiedInfo.body") }]}
    />
  );
};

export default UnverifiedTokenInfoBottomSheet;
