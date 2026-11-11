import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import {
  CustomHeaderButton,
  HEADER_BUTTON_BOX,
} from "components/layout/CustomHeaderButton";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Varial's nav bar (Figma Header, ?node-id=1123-102581): a 32pt row with
 * 16pt side insets and 24pt below it. The row sits 8pt below the safe-area
 * top, a little more room than Figma draws, as agreed with design.
 */
const ROW_TOP_SPACING = 8;
/**
 * The least distance from the screen's top to the row, in dp. A short status
 * bar, such as a Galaxy S22's 27dp or an iPhone SE's 20pt, would otherwise
 * leave the row crowding it, as would a device that reports no top inset.
 * Not scaled: it's about clearing the status bar.
 */
const MIN_ROW_TOP = 45;
const SIDE_INSET = 16;
const BOTTOM_PADDING = 24;

/**
 * Where the nav row starts, from the screen's top inset. Headers drawn
 * outside the stack (the camera screens) use it so their buttons land
 * exactly where every other screen's do.
 */
export const getNavigationHeaderPaddingTop = (topInset: number): number =>
  Math.max(topInset + pxValue(ROW_TOP_SPACING), MIN_ROW_TOP);

/** The nav row's top and side padding, for headers drawn outside the stack. */
export const getNavigationHeaderRowInsets = (topInset: number) => ({
  paddingTop: getNavigationHeaderPaddingTop(topInset),
  paddingHorizontal: pxValue(SIDE_INSET),
});

/**
 * The bar's height from the screen's top: the row's top padding, the row and
 * the padding under it. Home's content starts here under its floating header.
 */
export const getNavigationHeaderHeight = (topInset: number): number =>
  getNavigationHeaderPaddingTop(topInset) +
  HEADER_BUTTON_BOX.height +
  pxValue(BOTTOM_PADDING);

interface NavigationHeaderBarProps {
  title?: string;
  /** The left button. Without one, a spacer keeps the title centered. */
  left?: React.ReactNode;
  /** The right button. Without one, a spacer keeps the title centered. */
  right?: React.ReactNode;
  /**
   * Set when the bar sits in content that already clears the top inset, as
   * Discover's does. The bar then adds only the row's own spacing.
   */
  isBelowTopInset?: boolean;
  /** Set when the screen draws its own background behind the bar, as Home's fade does. */
  isTransparent?: boolean;
}

/**
 * Varial's nav bar: a 32pt row of buttons and an 18pt title, 8pt below the
 * status bar with 24pt under it. The stack header draws it, and so do
 * screens that draw their own header, such as Discover.
 */
export const NavigationHeaderBar: React.FC<NavigationHeaderBarProps> = ({
  title,
  left,
  right,
  isBelowTopInset = false,
  isTransparent = false,
}) => {
  const insets = useSafeAreaInsets();
  const rowInsets = getNavigationHeaderRowInsets(insets.top);

  return (
    <View
      testID="navigation-header"
      className={`flex-row justify-between items-center${isTransparent ? "" : " bg-base-0"}`}
      style={{
        ...rowInsets,
        paddingTop: rowInsets.paddingTop - (isBelowTopInset ? insets.top : 0),
        paddingBottom: pxValue(BOTTOM_PADDING),
      }}
    >
      {left ?? (
        <View testID="navigation-header-spacer" style={HEADER_BUTTON_BOX} />
      )}
      {title !== undefined && (
        // Figma's Text/LG/600: Inter SemiBold 18/26.
        <Text lg primary semiBold>
          {title}
        </Text>
      )}
      {right ?? (
        <View testID="navigation-header-spacer" style={HEADER_BUTTON_BOX} />
      )}
    </View>
  );
};

const CustomNavigationHeader = (
  props: NativeStackHeaderProps | BottomTabHeaderProps,
) => {
  const { navigation, options = {} } = props;
  const { themeColors } = useColors();
  const baseColor = themeColors.base[1];
  const buttonProps = {
    canGoBack: navigation.canGoBack(),
    tintColor: baseColor,
    pressColor: baseColor,
    pressOpacity: 0.5,
  };

  return (
    <NavigationHeaderBar
      title={
        typeof options.headerTitle === "string"
          ? options.headerTitle
          : undefined
      }
      left={
        options.headerLeft ? (
          options.headerLeft(buttonProps)
        ) : (
          <CustomHeaderButton position="left" />
        )
      }
      right={options.headerRight?.(buttonProps)}
    />
  );
};

export default CustomNavigationHeader;
