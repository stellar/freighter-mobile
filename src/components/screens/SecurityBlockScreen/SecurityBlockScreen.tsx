import Icon from "components/sds/Icon";
import { Text as SDSText } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View, Text } from "react-native";

/**
 * Full-screen blocking component shown when jailbreak/root is detected
 * User cannot dismiss this screen or use the app
 */
export const SecurityBlockScreen: React.FC = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-1">
      <View className="bg-gray-3 rounded-[24px] p-6 w-full max-w-sm">
        <View className="mb-6">
          <Icon.AlertCircle
            circle
            size={56}
            circleBackground={themeColors.red[3]}
            circleBorder={themeColors.red[6]}
            themeColor="red"
          />
        </View>

        <Text className="text-xl font-semibold text-gray-12 text-left mb-4">
          {t("security.jailbreakDetected.title")}
        </Text>

        <SDSText secondary md>
          {t("security.jailbreakDetected.description")}
        </SDSText>

        <SDSText secondary sm>
          {t("security.jailbreakDetected.disclaimer")}
        </SDSText>
      </View>
    </View>
  );
};
