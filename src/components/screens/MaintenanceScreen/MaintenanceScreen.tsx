import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { useMaintenanceMode } from "hooks/useMaintenanceMode";
import React from "react";
import { View } from "react-native";

/**
 * Full-screen blocking component shown when maintenance_screen flag is enabled.
 * Prevents all user interaction until the flag is disabled.
 */
export const MaintenanceScreen: React.FC = () => {
  const { screenContent } = useMaintenanceMode();

  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-1">
      <View className="bg-gray-3 rounded-[24px] p-6 w-full max-w-sm">
        <View className="mb-6 size-12 rounded-lg items-center justify-center bg-lilac-3 border border-lilac-6">
          <Icon.AlertCircle themeColor="lilac" size={24} />
        </View>

        <Text xl semiBold primary>
          {screenContent.title}
        </Text>

        <View className="mt-4 gap-3">
          {screenContent.body.map((paragraph) => (
            <Text key={paragraph} md regular secondary>
              {paragraph}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};
