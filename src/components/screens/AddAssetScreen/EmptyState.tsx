import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

const EmptyState: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 justify-center items-center">
      <Text sm secondary>
        {t("addAssetScreen.emptyState")}
      </Text>
    </View>
  );
};

export default EmptyState;
