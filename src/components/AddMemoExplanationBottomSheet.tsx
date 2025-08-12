import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";

type AddMemoExplanationBottomSheetProps = {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onAddMemo: () => void;
};

const AddMemoExplanationBottomSheet = ({
  modalRef,
  onAddMemo,
}: AddMemoExplanationBottomSheetProps) => {
  const { themeColors } = useColors();

  const onClose = () => {
    modalRef.current?.dismiss();
  };

  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <View className="relative flex-row items-center mb-8">
        <View className="bg-red-3 p-2 rounded-[8px]">
          <Icon.InfoOctagon
            color={themeColors.status.error}
            size={28}
            withBackground
          />
        </View>
        <TouchableOpacity onPress={onClose} className="absolute right-0">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={24}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium primary textAlign="left">
          {t("addMemoExplanationBottomSheet.title")}
        </Text>
      </View>
      <View className="mt-[24px] pr-8">
        <Text md medium secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.description")}
        </Text>
      </View>
      <View className="mt-[24px] pr-8">
        <Text md medium secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.disabledWarning")}
        </Text>
      </View>
      <View className="mt-[24px] pr-8">
        <Text md medium secondary textAlign="left">
          {t("addMemoExplanationBottomSheet.checkMemoRequirements")}
        </Text>
      </View>
      <View className="mt-[24px] gap-[12px] flex-row">
        <View className="flex-1">
          <Button onPress={onAddMemo} tertiary xl>
            {t("common.addMemo")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default AddMemoExplanationBottomSheet;
