import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

const ErrorState: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 items-center">
      <Text sm secondary>
        {t("addAssetScreen.somethingWentWrong")}
      </Text>
    </View>
  );
};

export default ErrorState;
