import React from "react";
import {
  PlatformOSType,
  StyleSheet,
  ViewProps,
  requireNativeComponent,
} from "react-native";

/**
 * Android's background blur for the floating tab bar (PillBlurPackage, on
 * Dimezis BlurView 3). The pill's blur view blurs a blur target, and each tab
 * screen is wrapped in one, since the tab bar sits next to the screens rather
 * than inside them.
 */

/** Android 12: the first version where the blur runs on RenderNodes. */
const PILL_BLUR_MIN_ANDROID_API_LEVEL = 31;

/**
 * Whether the tab bar can blur on Android. Before 12 the library snapshots in
 * software, which broke native-stack transitions with the old blur library.
 * iOS blurs with its own view.
 */
export const isPillBlurSupported = (
  os: PlatformOSType,
  androidApiLevel: number,
): boolean =>
  os === "android" && androidApiLevel >= PILL_BLUR_MIN_ANDROID_API_LEVEL;

/** The content the pill blurs. Only mounted where the blur is supported. */
const PillBlurTarget = requireNativeComponent<ViewProps>(
  "FreighterPillBlurTarget",
);

interface PillBlurViewProps extends ViewProps {
  /** The blur's standard deviation in dp, as Figma and CSS give it. */
  blurRadius: number;
}

/** Blurs the tab screen on display. Only mounted where it's supported. */
export const PillBlurView = requireNativeComponent<PillBlurViewProps>(
  "FreighterPillBlurView",
);

const styles = StyleSheet.create({ fill: { flex: 1 } });

/**
 * A tab navigator `screenLayout` that wraps each screen in a blur target, for
 * the pill to blur.
 */
export const renderPillBlurScreenLayout = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => (
  <PillBlurTarget testID="pill-blur-target" style={styles.fill}>
    {children}
  </PillBlurTarget>
);
