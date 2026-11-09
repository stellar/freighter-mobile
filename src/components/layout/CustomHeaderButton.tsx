import { useNavigation } from "@react-navigation/native";
import Icon from "components/sds/Icon";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

/**
 * Varial's header glyphs: the back arrow and the close X fill the 32pt
 * button with a 2pt stroke (Figma Header, ?node-id=371-9485).
 */
const HEADER_GLYPH_SIZE = 32;
const HEADER_GLYPH_STROKE_WIDTH = 2;

/**
 * The header button's box: Figma's 32pt icon frame, scaled like the glyph
 * (which `Icon` sizes with `pxValue`), so the glyph fills it exactly. Spacers
 * that keep a header title centred use the same box.
 */
export const HEADER_BUTTON_BOX = {
  width: pxValue(HEADER_GLYPH_SIZE),
  height: pxValue(HEADER_GLYPH_SIZE),
};

type HeaderButtonPosition = "left" | "right";

/** The navigation glyphs every Varial header shares. */
export type HeaderButtonVariant = "back" | "close";

const VARIANT_ICONS = {
  back: Icon.ArrowLeft,
  close: Icon.X,
} as const;

type HeaderIcon = React.ComponentType<{ size?: number; color?: string }>;

interface CustomHeaderButtonProps {
  position?: HeaderButtonPosition;
  /**
   * Draws Varial's back arrow or close X. A left button with no `icon`
   * defaults to `back`. Takes precedence over `icon`.
   */
  variant?: HeaderButtonVariant;
  onPress?: () => void;
  icon?: HeaderIcon;
  /** Size of a custom `icon`; the variants are always 32. */
  iconSize?: number;
  /** Icon color; defaults to themeColors.text.primary. */
  iconColor?: string;
  className?: string;
  hitSlop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  testID?: string;
  /**
   * Screen-reader name for the button. The variants default to "Back" and
   * "Close"; a custom icon has no text for assistive tech to announce, so
   * callers should always provide one.
   */
  accessibilityLabel?: string;
}

/**
 * CustomHeaderButton Component
 *
 * A header button for the left or right side of a navigation header.
 *
 * VARIANTS (both 32pt with a 2pt stroke, as Varial's header draws them):
 * - `back`: the back arrow, and the left default. Action: navigation.goBack().
 * - `close`: the close X. On the left its action is navigation.goBack().
 *
 * CUSTOM ICONS (`icon`) keep their own size (`iconSize`, 24 by default). A
 * right button with neither shows Icon.HelpCircle and has no action.
 *
 * USAGE EXAMPLES:
 *
 * 1. Back arrow with goBack:
 *    <CustomHeaderButton position="left" />
 *
 * 2. Close X with goBack:
 *    <CustomHeaderButton variant="close" />
 *
 * 3. Close X with a custom action:
 *    <CustomHeaderButton variant="close" onPress={closeFlow} />
 *
 * 4. Help button on the right:
 *    <CustomHeaderButton
 *      position="right"
 *      onPress={() => modalRef.current?.present()}
 *    />
 *
 * 5. Custom icon on the right:
 *    <CustomHeaderButton
 *      position="right"
 *      icon={Icon.Settings}
 *      onPress={() => navigation.navigate("Settings")}
 *    />
 *
 * @param position - Button position: "left" (default) or "right"
 * @param variant - "back" or "close"; the left default is "back"
 * @param onPress - Optional custom onPress handler
 * @param icon - Custom icon component
 * @param iconSize - Size of a custom icon (defaults to 24)
 * @param className - Additional CSS classes for styling
 * @param hitSlop - Custom hit slop values for touch area
 * @param testID - Optional testID for testing purposes
 */
export const CustomHeaderButton: React.FC<CustomHeaderButtonProps> = ({
  position = "left",
  variant,
  onPress,
  icon: CustomIcon,
  iconSize = 24,
  iconColor,
  className: customClassName,
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
  testID = "header-button",
  accessibilityLabel,
}) => {
  const navigation = useNavigation();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const color = iconColor ?? themeColors.text.primary;

  const resolvedVariant: HeaderButtonVariant | undefined =
    variant ?? (!CustomIcon && position === "left" ? "back" : undefined);

  const variantLabels: Record<HeaderButtonVariant, string> = {
    back: t("common.back"),
    close: t("common.close"),
  };

  // Default icon alignment based on position
  const getClassName = () => {
    if (customClassName) return customClassName;
    return position === "left"
      ? "justify-center items-start"
      : "justify-center items-center";
  };

  // Default behaviors based on position
  const getDefaultOnPress = () => {
    if (onPress) return onPress;
    if (position === "left") return () => navigation.goBack();
    return undefined; // Right position has no default action
  };

  const handlePress = getDefaultOnPress();
  const VariantIcon = resolvedVariant ? VARIANT_ICONS[resolvedVariant] : null;
  const IconComponent = CustomIcon ?? Icon.HelpCircle;

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={getClassName()}
      // A custom className sizes the button itself.
      style={customClassName ? undefined : HEADER_BUTTON_BOX}
      hitSlop={hitSlop}
      disabled={!handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (resolvedVariant ? variantLabels[resolvedVariant] : undefined)
      }
    >
      {VariantIcon ? (
        <VariantIcon
          size={HEADER_GLYPH_SIZE}
          color={color}
          strokeWidth={HEADER_GLYPH_STROKE_WIDTH}
        />
      ) : (
        <IconComponent size={iconSize} color={color} />
      )}
    </TouchableOpacity>
  );
};
