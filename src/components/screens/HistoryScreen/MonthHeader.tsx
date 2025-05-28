import { Text } from "components/sds/Typography";
import { getMonthLabel } from "helpers/date";
import React from "react";
import { View } from "react-native";

interface MonthHeaderProps {
  month: string;
}

/**
 * Shared component for rendering month headers in history sections
 */
const MonthHeader: React.FC<MonthHeaderProps> = React.memo(
  ({ month }: { month: string }) => (
    <View className="mb-6">
      <Text lg primary medium>
        {getMonthLabel(Number(month.split(":")[0]))}
      </Text>
    </View>
  ),
);

MonthHeader.displayName = "MonthHeader";

export default MonthHeader;
