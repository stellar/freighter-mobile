import Spinner from "components/Spinner";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export type TextButtonVariant = "primary" | "secondary" | "error" | "warning";

export interface TextButtonProps {
  /** The button text to display */
  text: string;
  /** Optional onPress handler for the button */
  onPress?: () => void;
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** The variant/color scheme of the button */
  variant?: TextButtonVariant;
  /** Optional className for additional styling */
  className?: string;
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * TextButton component for displaying text-only buttons with consistent styling.
 * Supports multiple variants, loading states, and can be disabled.
 *
 * @example
 * // Basic usage
 * <TextButton
 *   text="Continue anyway"
 *   onPress={() => handleContinue()}
 * />
 *
 * // With loading state
 * <TextButton
 *   text="Processing..."
 *   isLoading={true}
 *   onPress={() => handleProcess()}
 * />
 *
 * // With error variant
 * <TextButton
 *   text="Delete anyway"
 *   variant="error"
 *   onPress={() => handleDelete()}
 * />
 *
 * @param {TextButtonProps} props - The component props
 * @param {string} props.text - The button text to display
 * @param {() => void} [props.onPress] - Optional onPress handler
 * @param {boolean} [props.isLoading=false] - Whether the button is in a loading state
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {TextButtonVariant} [props.variant="secondary"] - The variant/color scheme
 * @param {string} [props.className] - Optional className for additional styling
 * @param {string} [props.testID] - Optional test ID for testing
 */
export const TextButton: React.FC<TextButtonProps> = ({
  text,
  onPress,
  isLoading = false,
  disabled = false,
  variant = "secondary",
  className = "",
  testID,
}) => {
  const { themeColors } = useColors();

  // Determine text color based on variant
  const getTextColor = () => {
    switch (variant) {
      case "error":
        return themeColors.red[11];
      case "warning":
        return themeColors.amber[11];
      case "primary":
        return themeColors.text.primary;
      case "secondary":
      default:
        return themeColors.text.secondary;
    }
  };

  const isDisabled = disabled || isLoading || !onPress;

  const content = (
    <View className={`w-full justify-center items-center ${className}`}>
      {isLoading ? (
        <Spinner testID="spinner" size="small" />
      ) : (
        <Text md semiBold color={getTextColor()}>
          {text}
        </Text>
      )}
    </View>
  );

  // Only render TouchableOpacity if we have onPress and are not disabled
  if (onPress && !isDisabled) {
    return (
      <TouchableOpacity onPress={onPress} className="w-full" testID={testID}>
        {content}
      </TouchableOpacity>
    );
  }

  // Otherwise render as a View (disabled or no onPress)
  return (
    <View className="w-full" testID={testID}>
      {content}
    </View>
  );
};
