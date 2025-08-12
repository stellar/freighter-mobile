import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

export const RequiredMemoMissingWarning = () => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return (
    <View className="mt-[16px] rounded-[16px] py-[12px] px-[24px] gap-[12px] bg-red-3 w-full">
      <View className="flex-row items-center gap-[8px] justify-between">
        <View className="flex-row items-center gap-[8px]">
          <Icon.AlertSquare size={16} color={themeColors.status.error} />
          <Text md color={themeColors.red[11]}>
            {t("transactionAmountScreen.memoMissing")}
          </Text>
        </View>
        <View>
          <Icon.ChevronRight size={16} color={themeColors.red[11]} />
        </View>
      </View>
    </View>
  );
};
