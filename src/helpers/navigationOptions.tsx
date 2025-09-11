import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import Icon from "components/sds/Icon";
import React from "react";

/**
 * Common navigation options for screens that slide from bottom
 */
export const getScreenBottomNavigateOptions = (
  title: string,
  showCloseButton: boolean = true,
): NativeStackNavigationOptions => ({
  headerTitle: title,
  headerShown: true,
  header: (props) => <CustomNavigationHeader {...props} />,
  headerLeft: showCloseButton
    ? () => <CustomHeaderButton icon={Icon.X} />
    : undefined,
  animation: "slide_from_bottom",
  animationTypeForReplace: "push",
});

/**
 * Common navigation options for stack navigators that slide from bottom
 */
export const getStackBottomNavigateOptions =
  (): NativeStackNavigationOptions => ({
    animation: "slide_from_bottom",
    animationTypeForReplace: "push",
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
  animation: "slide_from_bottom",
  animationTypeForReplace: "push",
});

/**
 * Navigation options for screens with no header
 */
export const getScreenOptionsNoHeader = (): NativeStackNavigationOptions => ({
  headerShown: false,
  animation: "slide_from_bottom",
  animationTypeForReplace: "push",
});

/**
 * Navigation options for screens with close button and custom title
 */
export const getScreenOptionsWithCloseButton = (
  title: string,
): NativeStackNavigationOptions => ({
  headerTitle: title,
  headerShown: true,
  header: (props) => <CustomNavigationHeader {...props} />,
  headerLeft: () => <CustomHeaderButton icon={Icon.X} />,
  animation: "slide_from_bottom",
  animationTypeForReplace: "push",
});
