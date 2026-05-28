import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export interface TrustlineInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

export const TrustlineInfoBottomSheet: React.FC<
  TrustlineInfoBottomSheetProps
> = ({ bottomSheetModalRef }) => {
  const { t } = useAppTranslation();

  const handleConfirm = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  return (
    <View className="gap-[16px] p-[4px]">
      <Text lg primary medium>
        {t("swapScreen.trustlineInfo.title")}
      </Text>
      <Text md secondary>
        {t("swapScreen.trustlineInfo.body")}
      </Text>
      <Button onPress={handleConfirm} primary>
        {t("swapScreen.trustlineInfo.confirm")}
      </Button>
    </View>
  );
};

export default TrustlineInfoBottomSheet;
