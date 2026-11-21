import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/** Filled, centered success toast body. Pass as a toast's `content`. */
export const SuccessToastBanner: React.FC<{ title: string }> = ({ title }) => {
  const { themeColors } = useColors();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={title}
      style={{
        backgroundColor: themeColors.green[3],
        borderRadius: pxValue(16),
        paddingHorizontal: pxValue(16),
        paddingVertical: pxValue(12),
        alignItems: "center",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: pxValue(8) }}
      >
        <Icon.CheckCircle size={16} color={themeColors.status.success} />
        <Text
          sm
          medium
          color={themeColors.green[11]}
          style={{
            lineHeight: pxValue(20),
            textAlign: "center",
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
};
