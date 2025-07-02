import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface RecoveryPhraseSkipBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onConfirm: () => void;
  onDismiss: () => void;
}

const CustomContent: React.FC<{
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({ onConfirm, onDismiss }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View className="w-10 h-10 rounded-full items-center justify-center bg-red-3 border border-red-6">
          <Icon.AlertTriangle size={24} color={themeColors.red[9]} />
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium>
          {t("recoverySkipModal.title")}
        </Text>
        <View className="h-4" />
        <View className="h-px mb-4 bg-border-primary" />
        <View className="mb-5">
          <Text md medium secondary>
            {t("recoverySkipModal.description1")}
          </Text>
          <View className="h-2" />
          <Text md medium secondary>
            {t("recoverySkipModal.description2")}
            <Text md medium style={{ color: themeColors.text.primary }}>
              {t("recoverySkipModal.description3")}
            </Text>
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button tertiary lg isFullWidth onPress={onConfirm}>
          {t("recoverySkipModal.confirm")}
        </Button>
        <Button secondary lg isFullWidth onPress={onDismiss}>
          {t("recoverySkipModal.cancel")}
        </Button>
      </View>
    </View>
  );
};

const RecoveryPhraseSkipBottomSheet: React.FC<
  RecoveryPhraseSkipBottomSheetProps
> = ({ modalRef, onConfirm, onDismiss }) => (
  <BottomSheet
    modalRef={modalRef}
    handleCloseModal={onDismiss}
    bottomSheetModalProps={{
      onDismiss,
      enableDynamicSizing: true,
    }}
    customContent={
      <CustomContent onConfirm={onConfirm} onDismiss={onDismiss} />
    }
  />
);

export default RecoveryPhraseSkipBottomSheet;
