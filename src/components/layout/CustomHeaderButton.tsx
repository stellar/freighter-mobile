import { useNavigation } from "@react-navigation/native";
import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

export const DEFAULT_HEADER_BUTTON_SIZE = "w-10 h-10";

type HeaderButtonPosition = "left" | "right";

interface CustomHeaderButtonProps {
  position?: HeaderButtonPosition;
  onPress?: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconSize?: number;
  className?: string;
  hitSlop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * CustomHeaderButton Component
 *
 * A customizable header button component that can be positioned on the left or right
 * side of navigation headers with appropriate default behaviors.
 *
 * POSITION-BASED DEFAULTS:
 *
 * LEFT POSITION (position="left"):
 * - Default icon: Icon.ArrowLeft (back arrow)
 * - Default action: navigation.goBack()
 * - Common use case: Back buttons, close buttons, menu buttons
 *
 * RIGHT POSITION (position="right"):
 * - Default icon: Icon.HelpCircle (info circle)
 * - Default action: None (disabled)
 * - Common use case: Help buttons, settings buttons
 *
 * USAGE EXAMPLES:
 *
 * 1. Default left button (back arrow with goBack):
 *    <CustomHeaderButton position="left" />
 *
 * 2. Default right button (info icon, no action):
 *    <CustomHeaderButton position="right" />
 *
 * 3. Close button with X icon on left:
 *    <CustomHeaderButton position="left" icon={Icon.X} />
 *
 * 4. Help button on right with action:
 *    <CustomHeaderButton
 *      position="right"
 *      onPress={() => modalRef.current?.present()}
 *    />
 *
 * 5. Custom styling:
 *    <CustomHeaderButton
 *      position="left"
 *      className="w-12 h-12 bg-background-secondary rounded-full"
 *      iconSize={20}
 *    />
 *
 * 6. Menu button on right:
 *    <CustomHeaderButton
 *      position="right"
 *      onPress={() => openMenu()}
 *      icon={Icon.Menu}
 *    />
 *
 * 7. Settings button on right:
 *    <CustomHeaderButton
 *      position="right"
 *      onPress={() => navigation.navigate('Settings')}
 *      icon={Icon.Settings}
 *    />
 *
 * 8. Custom touch area:
 *    <CustomHeaderButton
 *      position="left"
 *      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
 *    />
 *
 * @param position - Button position: "left" (default) or "right"
 * @param onPress - Optional custom onPress handler
 * @param icon - Custom icon component (defaults based on position)
 * @param iconSize - Size of the icon (defaults to 24)
 * @param className - Additional CSS classes for styling
 * @param hitSlop - Custom hit slop values for touch area
 */
export const CustomHeaderButton: React.FC<CustomHeaderButtonProps> = ({
  position = "left",
  onPress,
  icon: CustomIcon,
  iconSize = 24,
  className: customClassName,
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
}) => {
  const navigation = useNavigation();
  const { themeColors } = useColors();
  const baseColor = themeColors.base[1];

  // Default icon alignment based on position
  const getClassName = () => {
    if (customClassName) return customClassName;
    return position === "left"
      ? `${DEFAULT_HEADER_BUTTON_SIZE} justify-center items-start`
      : `${DEFAULT_HEADER_BUTTON_SIZE} justify-center items-end`;
  };

  const className = getClassName();

  // Default icons based on position
  const getDefaultIcon = () => {
    if (CustomIcon) return CustomIcon;
    return position === "left" ? Icon.ArrowLeft : Icon.HelpCircle;
  };

  const IconComponent = getDefaultIcon();

  // Default behaviors based on position
  const getDefaultOnPress = () => {
    if (onPress) return onPress;
    if (position === "left") return () => navigation.goBack();
    return undefined; // Right position has no default action
  };

  const handlePress = getDefaultOnPress();

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={className}
      hitSlop={hitSlop}
      disabled={!handlePress}
      testID="header-button"
    >
      <IconComponent size={iconSize} color={baseColor} />
    </TouchableOpacity>
  );
};
