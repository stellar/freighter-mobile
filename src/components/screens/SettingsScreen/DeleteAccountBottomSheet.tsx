import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DeleteAccountBottomSheetProps {
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteAccountBottomSheet: React.FC<DeleteAccountBottomSheetProps> = ({
  onCancel,
  onConfirm,
}) => {
  const { t } = useAppTranslation();

  return (
    <View className="gap-[24px]">
      <BottomSheetHeader
        title={t("settings.deleteAccountConfirmTitle")}
        onClose={onCancel}
      />

      {/* Message */}
      <Text md secondary>
        {t("settings.deleteAccountConfirmMessage")}
      </Text>

      {/* Buttons */}
      <View className="gap-3">
        <Button xl tertiary onPress={onCancel}>
          {t("common.cancel")}
        </Button>

        <Button xl destructive onPress={onConfirm}>
          {t("settings.deleteAccount")}
        </Button>
      </View>
    </View>
  );
};

export default DeleteAccountBottomSheet;
