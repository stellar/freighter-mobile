import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/**
 * The filled, centered success toast from Figma ("USDT0 is added to your
 * wallet", node 1596:235623). Pass as a toast's `content`; the standard
 * Notification body has a border, shadow and left-aligned default-color text.
 */
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
