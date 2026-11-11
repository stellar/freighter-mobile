import { IconProps } from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, useColorScheme } from "react-native";

const ICON_SIZE = 20;
const ICON_STROKE_WIDTH = 2;

interface HomeActionButtonProps {
  Icon: React.FC<IconProps>;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * Action tile used on the Home screen's Add / Send / Swap row (Figma
 * 662:9780): a flexible, 82pt tall tile with a 16pt radius and 8pt padding,
 * holding a 20pt icon in Gray/9 over a Text/MD/600 label in primary text, 4pt
 * apart.
 *
 * The fill is Gray/2 in light and Gray/1 in dark, measured from Figma's
 * render. No single theme token says that: dark Gray/2 is #1C1C1C, lighter than
 * the tile Figma draws, so the shade is picked by the color scheme.
 *
 * The sizes are arbitrary-value classes because NativeWind's rem is 14 here:
 * `h-20` would come out at 70pt, not 82.
 */
export const HomeActionButton: React.FC<HomeActionButtonProps> = ({
  Icon: IconComponent,
  title,
  onPress,
  disabled = false,
  testID,
}) => {
  const { themeColors } = useColors();
  const colorScheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;
  const backgroundColor =
    colorScheme === "dark" ? themeColors.gray[1] : themeColors.gray[2];

  return (
    <TouchableOpacity
      className={`flex-1 h-[82px] rounded-[16px] p-[8px] items-center justify-center gap-[4px] ${
        disabled ? "opacity-50" : ""
      }`}
      style={{ backgroundColor }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      <IconComponent
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        color={themeColors.gray[9]}
      />
      <Text md semiBold>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default HomeActionButton;
