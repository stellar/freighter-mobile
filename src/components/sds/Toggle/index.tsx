import { TOGGLE_ANIMATION_DURATION } from "config/constants";
import useColors from "hooks/useColors";
import React, { useCallback, useEffect, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

export type ToggleSize = "sm" | "md" | "lg";

export interface ToggleProps {
  /** Unique identifier for the toggle */
  id: string;
  /** Whether the toggle is in the checked/on state */
  checked: boolean;
  /** Size variant of the toggle */
  size?: ToggleSize;
  /** Callback function when toggle state changes */
  onChange?: () => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Custom icon to display when toggle is unchecked */
  iconUnchecked?: React.ReactNode;
  /** Custom icon to display when toggle is checked */
  iconChecked?: React.ReactNode;
  /** Accessible label for screen readers */
  title?: string;
  /** Test identifier for testing */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

interface SizeConfig {
  trackWidth: number;
  trackHeight: number;
  thumbSize: number;
  trackPadding: number;
  thumbOffset: number;
}

const TOGGLE_SIZE_CONFIG: Record<ToggleSize, SizeConfig> = {
  sm: {
    trackWidth: 28,
    trackHeight: 16,
    thumbSize: 12,
    trackPadding: 2,
    thumbOffset: 12, // trackWidth - trackPadding * 2 - thumbSize
  },
  md: {
    trackWidth: 48,
    trackHeight: 26,
    thumbSize: 22,
    trackPadding: 2,
    thumbOffset: 22, // trackWidth - trackPadding * 2 - thumbSize
  },
  lg: {
    trackWidth: 60,
    trackHeight: 32,
    thumbSize: 28,
    trackPadding: 2,
    thumbOffset: 28, // trackWidth - trackPadding * 2 - thumbSize
  },
} as const;

const TOGGLE_SHADOW = {
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
  elevation: 2,
} as const;

const TOGGLE_BORDER_RADIUS = 100;
const TOGGLE_ACTIVE_OPACITY = 0.8;

// =============================================================================
// Component
// =============================================================================

/**
 * Toggle Component
 *
 * A high-quality toggle switch component that follows the Stellar Design System.
 * Features smooth animations, proper accessibility, and consistent styling across platforms.
 *
 * @example
 * Basic usage:
 * ```tsx
 * const [isEnabled, setIsEnabled] = useState(false);
 *
 * <Toggle
 *   id="notifications"
 *   checked={isEnabled}
 *   onChange={() => setIsEnabled(!isEnabled)}
 *   title="Enable notifications"
 * />
 * ```
 *
 * @example
 * With custom size and icons:
 * ```tsx
 * <Toggle
 *   id="dark-mode"
 *   checked={isDarkMode}
 *   onChange={toggleDarkMode}
 *   size="lg"
 *   iconChecked={<Icon.Sun size={16} />}
 *   iconUnchecked={<Icon.Moon size={16} />}
 *   title="Dark mode"
 * />
 * ```
 *
 * @example
 * Disabled state:
 * ```tsx
 * <Toggle
 *   id="disabled-toggle"
 *   checked={false}
 *   disabled
 *   title="Disabled toggle"
 * />
 * ```
 */
export const Toggle: React.FC<ToggleProps> = ({
  id,
  checked,
  size = "md",
  onChange,
  disabled = false,
  iconChecked,
  iconUnchecked,
  title,
  testID,
}) => {
  const { themeColors } = useColors();
  const animatedValue = useSharedValue(checked ? 1 : 0);

  const sizeConfig = useMemo(() => TOGGLE_SIZE_CONFIG[size], [size]);

  const colorConfig = useMemo(
    () => ({
      thumbColor: disabled ? themeColors.gray[8] : themeColors.base[0],
      trackColorUnchecked: disabled ? themeColors.gray[5] : themeColors.gray[4],
      trackColorChecked: disabled ? themeColors.gray[5] : themeColors.lilac[9],
      shadowColor: themeColors.base[1],
    }),
    [disabled, themeColors],
  );

  useEffect(() => {
    animatedValue.value = withTiming(checked ? 1 : 0, {
      duration: TOGGLE_ANIMATION_DURATION,
    });
  }, [checked, animatedValue]);

  const handlePress = useCallback(() => {
    if (!disabled && onChange) {
      onChange();
    }
  }, [disabled, onChange]);

  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      animatedValue.value,
      [0, 1],
      [colorConfig.trackColorUnchecked, colorConfig.trackColorChecked],
    );

    return { backgroundColor };
  }, [colorConfig]);

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = animatedValue.value * sizeConfig.thumbOffset;
    return {
      transform: [{ translateX }],
    };
  }, [sizeConfig]);

  const checkedIconStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
  }));

  const uncheckedIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - animatedValue.value,
  }));

  const thumbBaseStyle = useMemo(
    () => ({
      width: sizeConfig.thumbSize,
      height: sizeConfig.thumbSize,
      borderRadius: sizeConfig.thumbSize / 2,
      backgroundColor: colorConfig.thumbColor,
      shadowColor: colorConfig.shadowColor,
      ...TOGGLE_SHADOW,
      position: "relative" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    }),
    [sizeConfig, colorConfig],
  );

  const trackBaseStyle = useMemo(
    () => ({
      width: sizeConfig.trackWidth,
      height: sizeConfig.trackHeight,
      borderRadius: TOGGLE_BORDER_RADIUS,
      padding: sizeConfig.trackPadding,
      justifyContent: "center" as const,
    }),
    [sizeConfig],
  );

  const iconContainerStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: sizeConfig.thumbSize / 2,
      overflow: "hidden" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    }),
    [sizeConfig],
  );

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={TOGGLE_ACTIVE_OPACITY}
      testID={testID || `toggle-${id}`}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={title || `Toggle ${id}`}
      accessibilityHint={
        disabled
          ? "Toggle is disabled"
          : `${checked ? "Enabled" : "Disabled"}. Tap to ${checked ? "disable" : "enable"}.`
      }
      className="items-center"
    >
      <Animated.View style={[trackBaseStyle, trackAnimatedStyle]}>
        <Animated.View style={[thumbBaseStyle, thumbAnimatedStyle]}>
          {(iconChecked || iconUnchecked) && (
            <View className="absolute inset-0 justify-center items-center">
              {iconChecked && (
                <Animated.View style={[iconContainerStyle, checkedIconStyle]}>
                  {iconChecked}
                </Animated.View>
              )}
              {iconUnchecked && (
                <Animated.View style={[iconContainerStyle, uncheckedIconStyle]}>
                  {iconUnchecked}
                </Animated.View>
              )}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default Toggle;
