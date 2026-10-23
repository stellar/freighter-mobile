import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import {
  PillBackground,
  getPillSelectionColor,
} from "components/FloatingTabBar/PillBackground";
import {
  TAB_BAR_PILL_HEIGHT,
  TAB_ICON_SIZE,
  TAB_PILL_VERTICAL_INSET,
  TAB_TARGET_HEIGHT,
  TAB_TARGET_WIDTH,
  getPillBottomOffset,
  getPillWidth,
  getTabTargetLeft,
} from "components/FloatingTabBar/geometry";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import { useFloatingTabBarClearance } from "hooks/useFloatingTabBarClearance";
import useIsReduceMotionEnabled from "hooks/useIsReduceMotionEnabled";
import useKeyboardVisible from "hooks/useKeyboardVisible";
import React, { useContext, useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How the selection slides to a newly focused tab. `useIsReduceMotionEnabled`
 * decides whether it slides, following the setting live. Reanimated's own
 * default reads the setting once, at launch, and would keep the selection
 * jumping after Reduce Motion is turned off.
 */
const SELECTION_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.Never,
};

const styles = StyleSheet.create({
  // Absolute, so the screens fill the whole height and scroll under the
  // pill: React Navigation lays a tab bar out below the screens otherwise.
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  slot: {
    position: "absolute",
  },
  target: {
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * The bottom tab bar: a pill floating over the screens, with a selection
 * capsule that slides to the focused tab, or jumps under Reduce Motion. Tabs
 * behave as in React Navigation's own bar. The pill hides while the keyboard
 * is up.
 *
 * Design: Tab Bar Buttons ?node-id=3487-68630.
 */
export const FloatingTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const clearance = useFloatingTabBarClearance();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const isKeyboardVisible = useKeyboardVisible();
  const isReduceMotionEnabled = useIsReduceMotionEnabled();
  const scheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;
  const { themeColors } = useColors();

  // Screens can read this back through `useBottomTabBarHeight()`. It stays
  // reported while the keyboard hides the pill.
  useEffect(() => {
    onHeightChange?.(clearance);
  }, [clearance, onHeightChange]);

  const focusedLeft = pxValue(getTabTargetLeft(state.index));
  const selectionLeft = useSharedValue(focusedLeft);

  useEffect(() => {
    selectionLeft.value = isReduceMotionEnabled
      ? focusedLeft
      : withTiming(focusedLeft, SELECTION_TIMING);
  }, [focusedLeft, isReduceMotionEnabled, selectionLeft]);

  const selectionPosition = useAnimatedStyle(() => ({
    left: selectionLeft.value,
  }));

  if (isKeyboardVisible) {
    return null;
  }

  // React Native gives VoiceOver no trait for the tab role, so on iOS the
  // targets are buttons, as in React Navigation's own bar. Read at render,
  // as the pill reads its platform.
  const targetRole = Platform.OS === "ios" ? "button" : "tab";
  const targetHeight = pxValue(TAB_TARGET_HEIGHT);
  const slotFrame = {
    top: pxValue(TAB_PILL_VERTICAL_INSET),
    width: pxValue(TAB_TARGET_WIDTH),
    height: targetHeight,
  };
  const selectionColor = getPillSelectionColor(scheme, themeColors);
  // Android shows a press at once, as React Navigation's own bar did, not
  // only once the selection slides: a borderless ripple in the selection's
  // color, as tall as the capsule. iOS ignores it.
  const pressRipple = {
    color: selectionColor,
    borderless: true,
    radius: pxValue(TAB_TARGET_HEIGHT / 2),
  };

  return (
    <View
      testID="floating-tab-bar"
      pointerEvents="box-none"
      style={[styles.bar, { bottom: getPillBottomOffset(insets.bottom) }]}
    >
      <PillBackground
        width={pxValue(getPillWidth(state.routes.length))}
        height={pxValue(TAB_BAR_PILL_HEIGHT)}
      >
        <Animated.View
          testID="floating-tab-bar-selection"
          style={[
            styles.slot,
            slotFrame,
            {
              borderRadius: targetHeight / 2,
              backgroundColor: selectionColor,
            },
            selectionPosition,
          ]}
        />
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              testID={options.tabBarButtonTestID}
              accessibilityRole={targetRole}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              // iOS's large content viewer, as React Navigation's bar has: a
              // long press at a large accessibility text size shows the tab
              // enlarged, titled with its label.
              accessibilityShowsLargeContentViewer
              accessibilityLargeContentTitle={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              android_ripple={pressRipple}
              style={[
                styles.slot,
                styles.target,
                slotFrame,
                { left: pxValue(getTabTargetLeft(index)) },
              ]}
            >
              {options.tabBarIcon?.({
                focused,
                color: focused ? themeColors.base[1] : themeColors.gray[9],
                size: TAB_ICON_SIZE,
              })}
            </Pressable>
          );
        })}
      </PillBackground>
    </View>
  );
};
