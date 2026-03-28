import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import useColors from "hooks/useColors";
import React from "react";
import { StyleProp, ViewStyle, TouchableOpacity } from "react-native";

interface SectionTitleProps {
  title: string;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const SectionTitle: React.FC<SectionTitleProps> = React.memo(({
  title,
  onPress,
  className,
  style,
}) => {
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className={`flex-row items-center gap-1 ${className ?? ""}`}
      style={style}
      onPress={onPress}
      disabled={!onPress}
      delayPressIn={DEFAULT_PRESS_DELAY}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={title}
    >
      <Text md semiBold>
        {title}
      </Text>
      {onPress && (
        <Icon.ChevronRightBold size={16} color={themeColors.text.secondary} />
      )}
    </TouchableOpacity>
  );
});

SectionTitle.displayName = "SectionTitle";

export default SectionTitle;
