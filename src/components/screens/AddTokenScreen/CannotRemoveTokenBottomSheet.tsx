import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export enum CannotRemoveType {
  hasBalance = "has-balance",
  native = "native",
}

type CannotRemoveTokenBottomSheetProps = {
  type: CannotRemoveType;
  onDismiss: () => unknown;
};

const CannotRemoveTokenBottomSheet: React.FC<
  CannotRemoveTokenBottomSheetProps
> = ({ type, onDismiss }) => {
  const { t } = useAppTranslation();

  const title =
    type === CannotRemoveType.hasBalance
      ? t("manageTokensScreen.cantRemoveBalance.title")
      : t("manageTokensScreen.cantRemoveXlm.title");

  const description =
    type === CannotRemoveType.hasBalance
      ? t("manageTokensScreen.cantRemoveBalance.description")
      : t("manageTokensScreen.cantRemoveXlm.description");

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View className="size-10 rounded-lg items-center justify-center bg-red-3 border border-red-6">
          <Icon.MinusCircle themeColor="red" />
        </View>
        <Icon.X withBackground themeColor="gray" onPress={onDismiss} />
      </View>
      <View>
        <Text xl testID="bottom-sheet-content-title">
          {title}
        </Text>
        <View className="gap-4" />
        <Text secondary>{description}</Text>
        <View className="gap-4" />
      </View>
    </View>
  );
};

export default CannotRemoveTokenBottomSheet;
