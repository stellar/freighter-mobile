import {
  SPARKLE_GRAPHIC_SIZE,
  SparkleGraphic,
} from "components/WalletSetupOverlay/SparkleGraphic";
import {
  SPARKLE_LOOP_MS,
  sparklePoseAt,
} from "components/WalletSetupOverlay/sparkleMotion";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import React, { useEffect } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Figma's "Group 19" box. The keyframes move and scale it about its center.
 */
const BOX = { width: 24.141, height: 24 };
/** Figma draws the sparkle 11.48% of the box's width left of the box. */
const ASSET_LEFT = -2.7714;
/** How long the sparkle takes to settle at the center once it stops. */
const SETTLE_MS = 250;

const styles = StyleSheet.create({
  asset: { position: "absolute", top: 0 },
});

interface WalletSetupSparkleProps {
  /** Hops on Figma's loop while true; otherwise rests at the center. */
  isLooping: boolean;
  testID?: string;
}

/**
 * The wallet setup screen's sparkle, Figma's asset for the theme, hopping on
 * the keyframe loop in `sparkleMotion` while `isLooping`. When the loop
 * stops, mid-hop or not, it settles at the center rather than jumping
 * there.
 */
export const WalletSetupSparkle: React.FC<WalletSetupSparkleProps> = ({
  isLooping,
  testID,
}) => {
  const isLight = (useColorScheme() ?? DEFAULT_COLOR_SCHEME) === "light";
  const progress = useSharedValue(0);
  // 0 follows the loop, 1 is the rest pose; in between blends the two.
  const settle = useSharedValue(isLooping ? 0 : 1);
  const unit = pxValue(1);

  useEffect(() => {
    if (isLooping) {
      settle.value = 0;
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: SPARKLE_LOOP_MS, easing: Easing.linear }),
        -1,
      );
      return;
    }

    cancelAnimation(progress);
    settle.value = withTiming(1, {
      duration: SETTLE_MS,
      easing: Easing.out(Easing.ease),
    });
  }, [isLooping, progress, settle]);

  const animatedStyle = useAnimatedStyle(() => {
    const pose = sparklePoseAt(progress.value);
    const looping = 1 - settle.value;

    return {
      transform: [
        { translateX: pose.translateX * looping * unit },
        { translateY: pose.translateY * looping * unit },
        { scaleX: 1 + (pose.scaleX - 1) * looping },
        { scaleY: 1 + (pose.scaleY - 1) * looping },
      ],
    };
  });

  return (
    <Animated.View
      testID={testID}
      style={[
        { width: pxValue(BOX.width), height: pxValue(BOX.height) },
        animatedStyle,
      ]}
    >
      <View style={[styles.asset, { left: pxValue(ASSET_LEFT) }]}>
        <SparkleGraphic
          isLight={isLight}
          testID={
            testID ? `${testID}-${isLight ? "light" : "dark"}` : undefined
          }
          width={pxValue(SPARKLE_GRAPHIC_SIZE.width)}
          height={pxValue(SPARKLE_GRAPHIC_SIZE.height)}
        />
      </View>
    </Animated.View>
  );
};
