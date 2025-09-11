import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

type CannotRemoveXlmBottomSheetProps = {
  type: "has-balance" | "native";
  onDismiss: () => unknown;
};

const CannotRemoveXlmBottomSheet: React.FC<CannotRemoveXlmBottomSheetProps> = ({
  type,
  onDismiss,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  const title =
    type === "has-balance"
      ? t("manageTokensScreen.cantRemoveBalance.title")
      : t("manageTokensScreen.cantRemoveXlm.title");

  const description =
    type === "has-balance"
      ? t("manageTokensScreen.cantRemoveBalance.description")
      : t("manageTokensScreen.cantRemoveXlm.description");

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View className="size-10 rounded-lg items-center justify-center bg-red-3 border border-red-6">
          <Icon.MinusCircle themeColor="red" />
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl testID="bottom-sheet-content-title">
          {title}
        </Text>
        <View className="h-4" />
        <Text secondary>
          {description}
        </Text>
        <View className="h-4" />
      </View>
    </View>
  );
};

export default CannotRemoveXlmBottomSheet;
