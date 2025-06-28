import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const OfflineMessage = () => {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  return (
    <View
      className="absolute top-0 left-0 right-0 bg-status-error z-10"
      style={{ paddingTop: insets.top }}
    >
      <View className="p-1 items-center">
        <Text primary sm semiBold>
          {t("noInternetConnection")}
        </Text>
      </View>
    </View>
  );
};
