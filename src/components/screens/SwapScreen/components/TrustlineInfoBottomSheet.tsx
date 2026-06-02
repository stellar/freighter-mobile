import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface TrustlineInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /**
   * Destination token code, interpolated into the title and body
   * ("This will add a trustline to AQUA").
   */
  tokenCode?: string;
}

export const TrustlineInfoBottomSheet: React.FC<
  TrustlineInfoBottomSheetProps
> = ({ bottomSheetModalRef, tokenCode }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const handleConfirm = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  const interpolation = { tokenCode: tokenCode ?? "" };

  return (
    <View className="gap-[16px]">
      <View className="flex-row items-center justify-between">
        <Icon.PlusCircle themeColor="lilac" withBackground square size={24} />
        <TouchableOpacity
          onPress={handleConfirm}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
          testID="trustline-info-close"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>
      <Text xl medium>
        {t("swapScreen.trustlineInfo.title", interpolation)}
      </Text>
      <Text md regular secondary>
        {t("swapScreen.trustlineInfo.bodyPrefix", interpolation)}
        <Text md medium>
          {t("swapScreen.trustlineInfo.bodyEmphasis")}
        </Text>
        {t("swapScreen.trustlineInfo.bodySuffix", interpolation)}
      </Text>
      <Button onPress={handleConfirm} primary>
        {t("swapScreen.trustlineInfo.confirm")}
      </Button>
    </View>
  );
};

export default TrustlineInfoBottomSheet;
