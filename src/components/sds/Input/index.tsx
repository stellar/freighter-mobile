import Clipboard from "@react-native-clipboard/clipboard";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import styled from "styled-components/native";

// =============================================================================
// Constants and types
// =============================================================================

const INPUT_SIZES = {
  sm: {
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
    borderRadius: 4,
  },
  md: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    borderRadius: 6,
  },
  lg: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    borderRadius: 8,
  },
} as const;

export type InputSize = keyof typeof INPUT_SIZES;

// =============================================================================
// Styled components
// =============================================================================

interface StyledProps {
  $fieldSize: InputSize;
  $isError?: boolean;
  $isDisabled?: boolean;
  $hasLeftElement?: boolean;
  $hasRightElement?: boolean;
  position?: "left" | "right";
  $variant?: "error" | "success";
}

const Container = styled.View<Pick<StyledProps, "$fieldSize">>`
  width: 100%;
  gap: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(INPUT_SIZES[$fieldSize].gap)};
`;

const InputContainer = styled.View<
  Pick<StyledProps, "$fieldSize" | "$isError" | "$isDisabled">
>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ $isDisabled }: Pick<StyledProps, "$isDisabled">) =>
    $isDisabled
      ? THEME.colors.background.secondary
      : THEME.colors.background.default};
  border-width: 1px;
  border-color: ${({ $isError }: Pick<StyledProps, "$isError">) => {
    if ($isError) {
      return THEME.colors.status.error;
    }
    return THEME.colors.border.default;
  }};
  border-radius: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(INPUT_SIZES[$fieldSize].borderRadius)};
  padding-horizontal: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(INPUT_SIZES[$fieldSize].paddingHorizontal)};
`;

const StyledTextInput = styled.TextInput<
  Pick<StyledProps, "$fieldSize" | "$hasLeftElement" | "$hasRightElement">
>`
  flex: 1;
  height: ${({ $fieldSize }: { $fieldSize: InputSize }) =>
    px(
      INPUT_SIZES[$fieldSize].lineHeight +
        2 * INPUT_SIZES[$fieldSize].paddingVertical,
    )};
  font-size: ${({ $fieldSize }: { $fieldSize: InputSize }) =>
    fs(INPUT_SIZES[$fieldSize].fontSize)};
  color: ${THEME.colors.text.primary};
  font-family: ${Platform.select({
    ios: "Inter-Variable",
    android: "Inter-Regular",
  })};
  font-weight: ${Platform.select({
    ios: "400",
    android: "normal",
  })};
`;

const SideElement = styled.View<{ position: "left" | "right" }>`
  justify-content: center;
  margin-${({ position }: { position: "left" | "right" }) => position}: ${px(8)};
`;

const FieldNoteWrapper = styled.View`
  margin-top: ${px(4)};
`;

// =============================================================================
// Component
// =============================================================================

/**
 * Input component for text entry with various styling and functionality options.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Input
 *   value={text}
 *   onChangeText={setText}
 *   placeholder="Enter text..."
 * />
 * ```
 *
 * @example
 * With validation and keyboard types:
 * ```tsx
 * <Input
 *   label="Email Address"
 *   labelSuffix="(required)"
 *   value={email}
 *   onChangeText={setEmail}
 *   error={!isValidEmail(email) && "Please enter a valid email"}
 *   keyboardType="email-address"
 *   autoCapitalize="none"
 * />
 * ```
 *
 * @example
 * With side elements:
 * ```tsx
 * <Input
 *   label="Password"
 *   value={password}
 *   onChangeText={setPassword}
 *   isPassword
 *   rightElement={
 *     <Icon
 *       name={showPassword ? "eye-off" : "eye"}
 *       onPress={togglePasswordVisibility}
 *     />
 *   }
 * />
 * ```
 *
 * @example
 * With copy functionality:
 * ```tsx
 * <Input
 *   label="Wallet Address"
 *   value={walletAddress}
 *   copyButton={{ position: "right", showLabel: true }}
 *   note="Click the copy button to copy the address"
 *   editable={false}
 * />
 * ```
 *
 * @param {InputProps} props - The component props
 * @param {string} [props.fieldSize="md"] - Size variant of the input field ("sm" | "md" | "lg")
 * @param {string | ReactNode} [props.label] - Label text or component to display above the input
 * @param {string | ReactNode} [props.labelSuffix] - Additional text to display after the label
 * @param {boolean} [props.isLabelUppercase] - Whether to transform the label text to uppercase
 * @param {boolean} [props.isError] - Whether to show error styling
 * @param {boolean} [props.isPassword] - Whether the input is for password entry
 * @param {JSX.Element} [props.leftElement] - Element to render on the left side of the input
 * @param {JSX.Element} [props.rightElement] - Element to render on the right side of the input
 * @param {string | ReactNode} [props.note] - Helper text to display below the input
 * @param {string | ReactNode} [props.error] - Error message to display below the input
 * @param {string | ReactNode} [props.success] - Success message to display below the input
 * @param {Object} [props.copyButton] - Configuration for the copy button
 * @param {string} props.value - The input value
 * @param {Function} [props.onChangeText] - Callback when text changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.editable=true] - Whether the input is editable
 * @param {string} [props.testID] - Test ID for testing
 * @param {("none" | "sentences" | "words" | "characters")} [props.autoCapitalize] - Text capitalization behavior
 * @param {("default" | "number-pad" | "decimal-pad" | "numeric" | "email-address" | "phone-pad")} [props.keyboardType] - Keyboard type for the input
 */
interface InputProps {
  id?: string;
  testID?: string;
  fieldSize?: InputSize;
  label?: string | React.ReactNode;
  labelSuffix?: string | React.ReactNode;
  isLabelUppercase?: boolean;
  isError?: boolean;
  isPassword?: boolean;
  leftElement?: React.JSX.Element;
  rightElement?: React.JSX.Element;
  note?: string | React.ReactNode;
  error?: string | React.ReactNode;
  success?: string | React.ReactNode;
  copyButton?: {
    position: "left" | "right";
    showLabel?: boolean;
  };
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?:
    | "default"
    | "number-pad"
    | "decimal-pad"
    | "numeric"
    | "email-address"
    | "phone-pad";
}

export const Input: React.FC<InputProps> = ({
  fieldSize = "md",
  label,
  labelSuffix,
  isLabelUppercase,
  isError,
  isPassword,
  leftElement,
  rightElement,
  note,
  error,
  success,
  copyButton,
  value = "",
  onChangeText,
  placeholder,
  editable = true,
  testID,
  ...props
}) => {
  const handleCopy = () => {
    if (!value) {
      return;
    }

    Clipboard.setString(value);
  };

  const getLabelSize = () => ({
    xs: fieldSize === "sm",
    sm: fieldSize === "md",
    md: fieldSize === "lg",
  });

  const renderCopyButton = (position: "left" | "right") => (
    <TouchableOpacity onPress={handleCopy}>
      <SideElement position={position}>
        <Text sm>{copyButton?.showLabel ? "Copy" : "📋"}</Text>
      </SideElement>
    </TouchableOpacity>
  );

  return (
    <Container $fieldSize={fieldSize}>
      {label && (
        <Text {...getLabelSize()} color={THEME.colors.text.secondary}>
          {isLabelUppercase ? label.toString().toUpperCase() : label}
          {labelSuffix && (
            <Text {...getLabelSize()} color={THEME.colors.text.secondary}>
              {" "}
              {labelSuffix}
            </Text>
          )}
        </Text>
      )}

      <InputContainer
        testID={testID ? `${testID}-container` : undefined}
        $fieldSize={fieldSize}
        $isError={isError || !!error}
        $isDisabled={!editable}
      >
        {copyButton?.position === "left" && renderCopyButton("left")}
        {leftElement && (
          <SideElement position="left">{leftElement}</SideElement>
        )}

        <StyledTextInput
          testID={testID}
          $fieldSize={fieldSize}
          $hasLeftElement={!!leftElement || copyButton?.position === "left"}
          $hasRightElement={!!rightElement || copyButton?.position === "right"}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={THEME.colors.text.secondary}
          secureTextEntry={isPassword}
          editable={editable}
          {...props}
        />

        {rightElement && (
          <SideElement position="right">{rightElement}</SideElement>
        )}
        {copyButton?.position === "right" && renderCopyButton("right")}
      </InputContainer>

      {note && (
        <FieldNoteWrapper>
          <Text sm color={THEME.colors.text.secondary}>
            {note}
          </Text>
        </FieldNoteWrapper>
      )}
      {error && (
        <FieldNoteWrapper>
          <Text sm color={THEME.colors.status.error}>
            {error}
          </Text>
        </FieldNoteWrapper>
      )}
      {success && (
        <FieldNoteWrapper>
          <Text sm color={THEME.colors.status.success}>
            {success}
          </Text>
        </FieldNoteWrapper>
      )}
    </Container>
  );
};
