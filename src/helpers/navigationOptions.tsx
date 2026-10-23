import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import { ScreenTransition } from "config/routes";
import React from "react";

/**
 * Common navigation options for stack navigators that slide from bottom
 */
export const getStackBottomNavigateOptions =
  (): NativeStackNavigationOptions => ({
    animation: "slide_from_bottom",
    animationTypeForReplace: "push",
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
  headerLeft: () => <CustomHeaderButton variant="close" />,
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
 * `transition` in its params. Used for ad-hoc transition overrides (e.g. a
 * screen opened with a fade from one entry point and a slide from another)
 * without changing the defaults for other entry points into the same screen.
 */
export const withTransitionOverride = (
  options: NativeStackNavigationOptions,
  route: {
    params?: { transition?: ScreenTransition };
  },
): NativeStackNavigationOptions => {
  const transition = route.params?.transition;
  return transition
    ? {
        ...options,
        animation: transition as NativeStackNavigationOptions["animation"],
      }
    : options;
};

interface SetPasswordScreenOptionsArgs {
  route: { params?: { isImporting?: boolean } };
}

/**
 * Set Password's transition and header.
 *
 * Creating a wallet, it is the flow's first step: it slides up from the
 * bottom like the app's other sheets, and its X slides it back down to
 * Welcome. Importing, it is the second step, after Import Wallet, and keeps
 * the stack's defaults: it slides in from the side, and its back arrow
 * returns to Import Wallet.
 */
export const getSetPasswordScreenOptions = ({
  route,
}: SetPasswordScreenOptionsArgs): NativeStackNavigationOptions =>
  route.params?.isImporting
    ? {}
    : {
        ...getStackBottomNavigateOptions(),
        headerLeft: () => <CustomHeaderButton variant="close" />,
      };

interface ScanQRCodeScreenOptionsArgs {
  route: { params?: { transition?: ScreenTransition } };
}

/**
 * Scan QR's transition. Opened over Send's recipient search, it slides up
 * from the bottom and closes with an X, and draws its own header over the
 * camera.
 */
export const getScanQRCodeScreenOptions = ({
  route,
}: ScanQRCodeScreenOptionsArgs): NativeStackNavigationOptions =>
  withTransitionOverride(getScreenOptionsNoHeader(), route);
