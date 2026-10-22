import Icon from "components/sds/Icon";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import React from "react";

/** What React Navigation hands a tab's `tabBarIcon`. */
interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

/** Figma draws the stroked tab icons with a 2pt stroke at any size. */
const TAB_ICON_STROKE_WIDTH = 2;

/**
 * Each tab's icon, from Figma's Tab Bar Buttons (?node-id=3487-68630).
 * History is a stroked clock and Home a filled house, focused or not.
 * Discover's compass fills in while its tab is focused. Every tab needs an
 * entry, so tsc fails if a tab is added without one.
 */
const TAB_BAR_ICONS: Record<
  keyof MainTabStackParamList,
  (props: TabBarIconProps) => React.ReactElement
> = {
  [MAIN_TAB_ROUTES.TAB_HISTORY]: ({ color, size }) => (
    <Icon.ClockRewind
      size={size}
      color={color}
      strokeWidth={TAB_ICON_STROKE_WIDTH}
    />
  ),
  [MAIN_TAB_ROUTES.TAB_HOME]: ({ color, size }) => (
    <Icon.HomeFilled size={size} color={color} />
  ),
  [MAIN_TAB_ROUTES.TAB_DISCOVERY]: ({ focused, color, size }) =>
    focused ? (
      <Icon.Compass03Filled size={size} color={color} />
    ) : (
      <Icon.Compass03
        size={size}
        color={color}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
      />
    ),
};

/**
 * The floating tab bar's icon for a tab. It's drawn alone, at the size and
 * in the colour the bar gives it: the bar paints the selection behind the
 * focused tab itself.
 */
export const renderTabBarIcon = (
  routeName: keyof MainTabStackParamList,
  props: TabBarIconProps,
): React.ReactElement => TAB_BAR_ICONS[routeName](props);
