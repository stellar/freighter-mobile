import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface DeleteAccountBottomSheetProps {
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteAccountBottomSheet: React.FC<DeleteAccountBottomSheetProps> = ({
  onCancel,
  onConfirm,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="gap-6">
      {/* Header with icon and close button */}
      <View className="flex-row justify-between items-center">
        <View className="size-10 rounded-lg items-center justify-center bg-red-3 border border-red-6">
          <Icon.Trash01 themeColor="red" />
        </View>
        <TouchableOpacity
          onPress={onCancel}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text xl medium primary>
        {t("settings.deleteAccountConfirmTitle")}
      </Text>

      {/* Message */}
      <Text md secondary>
        {t("settings.deleteAccountConfirmMessage")}
      </Text>

      {/* Buttons */}
      <View className="gap-3">
        <Button xl secondary onPress={onCancel}>
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
