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
    animationDuration: 350, // around 350ms for native slide_from_right/default animation
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
