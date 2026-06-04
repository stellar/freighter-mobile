import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface UnverifiedTokenInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const UnverifiedTokenInfoBottomSheet: React.FC<
  UnverifiedTokenInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleClose = () => bottomSheetModalRef?.current?.dismiss();

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        {/* `themeColor` doesn't support `gray`, so we render the same badge
            icon inside an explicit gray-3 box to match the unverified design. */}
        <View className="size-10 rounded-lg items-center justify-center bg-gray-3 border border-gray-6">
          <Icon.CheckVerified02 color={themeColors.gray[9]} />
        </View>
        <TouchableOpacity
          onPress={handleClose}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
          testID="unverified-token-info-close"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>
      <Text xl medium>
        {t("swapScreen.unverifiedInfo.title")}
      </Text>
      <Text md regular secondary>
        {t("swapScreen.unverifiedInfo.body")}
      </Text>
    </View>
  );
};

export default UnverifiedTokenInfoBottomSheet;
