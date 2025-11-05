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
  isLoading: boolean;
}

// Use Pick to reuse props from the main interface instead of duplicating
type CustomContentProps = Pick<
  RecoveryPhraseSkipBottomSheetProps,
  "onConfirm" | "onDismiss" | "isLoading"
>;

const CustomContent: React.FC<CustomContentProps> = ({
  onConfirm,
  onDismiss,
  isLoading,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="gap-6">
      <View className="flex-row justify-between items-center">
        <View className="w-10 h-10 rounded-full items-center justify-center bg-red-3 border border-red-6">
          <Icon.AlertTriangle color={themeColors.red[9]} />
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Icon.X color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>

      <View className="gap-4">
        <Text xl medium>
          {t("recoverySkipModal.title")}
        </Text>
        <View className="h-px bg-border-primary" />
        <View className="gap-4">
          <Text md regular secondary>
            {t("recoverySkipModal.description1")}
          </Text>
          <Text md regular secondary>
            {t("recoverySkipModal.description2")}
            <Text md regular>
              {t("recoverySkipModal.description3")}
            </Text>
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <Button tertiary isFullWidth onPress={onConfirm} isLoading={isLoading}>
          {t("recoverySkipModal.confirm")}
        </Button>
        <Button secondary isFullWidth onPress={onDismiss} disabled={isLoading}>
          {t("recoverySkipModal.cancel")}
        </Button>
      </View>
    </View>
  );
};

const RecoveryPhraseSkipBottomSheet: React.FC<
  RecoveryPhraseSkipBottomSheetProps
> = ({ modalRef, onConfirm, onDismiss, isLoading }) => (
  <BottomSheet
    modalRef={modalRef}
    handleCloseModal={onDismiss}
    customContent={
      <CustomContent
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        isLoading={isLoading}
      />
    }
  />
);

export default RecoveryPhraseSkipBottomSheet;
