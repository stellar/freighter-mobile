import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

type AddMemoExplanationBottomSheetProps = {
  onConfirm?: () => void;
  onClose: () => void;
};

const AddMemoExplanationBottomSheet = ({
  onConfirm,
  onClose,
}: AddMemoExplanationBottomSheetProps) => {
  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <BottomSheetHeader
        title={t("addMemoExplanationBottomSheet.title")}
        onClose={onClose}
      />
      <View className="mt-[24px] pr-8">
        <Text md regular secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.description")}
        </Text>
      </View>
      <View className="mt-[24px] pr-8">
        <Text md regular secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.disabledWarning")}
        </Text>
      </View>
      <View className="mt-[24px] pr-8">
        <Text md regular secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.checkMemoRequirements")}
        </Text>
      </View>
      {onConfirm && (
        <View className="mt-[24px] gap-[12px] flex-row">
          <View className="flex-1">
            <Button onPress={onConfirm} secondary xl>
              {t("common.addMemo")}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default AddMemoExplanationBottomSheet;
