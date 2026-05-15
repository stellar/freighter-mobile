import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import Icon from "components/sds/Icon";
import React from "react";

/**
 * Common navigation options for stack navigators that slide from bottom
 */
export const getStackBottomNavigateOptions =
  (): NativeStackNavigationOptions => ({
    animation: "slide_from_bottom",
    animationTypeForReplace: "push",
    animationDuration: 300, // 300ms for balance snappy and feel like slide_from_right/default - Native slide_from_right is ca. 350ms
  });

/**
 * Common navigation options for screens that slide from bottom
 */
export const getScreenBottomNavigateOptions = (
  title: string,
): NativeStackNavigationOptions => ({
  headerTitle: title,
  headerShown: true,
  header: (props) => <CustomNavigationHeader {...props} />,
  headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
  ...getStackBottomNavigateOptions(),
});

/**
 * Reset navigation options to default (no custom animation)
 */
export const resetNestedNavigationOptions = (
  title?: string,
): NativeStackNavigationOptions => ({
  headerTitle: title,
  headerShown: !!title,
  header: title ? (props) => <CustomNavigationHeader {...props} /> : undefined,
  animation: "default",
  animationTypeForReplace: "push",
});

/**
 * Navigation options for screens with custom header but no close button
 */
export const getScreenOptionsWithCustomHeader = (
  title: string,
): NativeStackNavigationOptions => ({
  headerTitle: title,
  headerShown: true,
  header: (props) => <CustomNavigationHeader {...props} />,
  ...getStackBottomNavigateOptions(),
});

/**
 * Navigation options for screens with no header
 */
export const getScreenOptionsNoHeader = (): NativeStackNavigationOptions => ({
  headerShown: false,
  ...getStackBottomNavigateOptions(),
});

/**
 * Wrap navigation options so a route can override the animation by passing
 * `transition` in its params. Used for ad-hoc transition overrides (e.g. the
 * fade between `ScanQRCodeScreen` and `AccountQRCodeScreen`) without changing
 * the defaults for other entry points into the same screen.
 */
export const withTransitionOverride = (
  options: NativeStackNavigationOptions,
  route: {
    params?: { transition?: NativeStackNavigationOptions["animation"] };
  },
): NativeStackNavigationOptions => {
  const transition = route.params?.transition;
  return transition ? { ...options, animation: transition } : options;
};
