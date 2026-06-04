import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface VerifiedTokenInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const VerifiedTokenInfoBottomSheet: React.FC<
  VerifiedTokenInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleClose = () => bottomSheetModalRef?.current?.dismiss();

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Icon.CheckVerified02
          themeColor="lilac"
          withBackground
          square
          size={24}
        />
        <TouchableOpacity
          onPress={handleClose}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
          testID="verified-token-info-close"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>
      <Text xl medium>
        {t("swapScreen.verifiedInfo.title")}
      </Text>
      <Text md regular secondary>
        {t("swapScreen.verifiedInfo.body")}
      </Text>
    </View>
  );
};

export default VerifiedTokenInfoBottomSheet;
