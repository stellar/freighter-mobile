import Clipboard from "@react-native-clipboard/clipboard";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import React, { useState } from "react";
import { Platform, TouchableOpacity, TextInput } from "react-native";
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

/**
 * Calculates the input height based on field size
 *
 * @param fieldSize - The size of the input field (sm, md, lg)
 * @returns The pixel height of the input field
 */
const getInputHeight = (fieldSize: InputSize): string =>
  px(
    INPUT_SIZES[fieldSize].lineHeight +
      3 * INPUT_SIZES[fieldSize].paddingVertical,
  );

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

export const StyledTextInput = styled.TextInput<
  Pick<
    StyledProps,
    "$fieldSize" | "$hasLeftElement" | "$hasRightElement" | "$isDisabled"
  >
>`
  flex: 1;
  height: ${({ $fieldSize }: { $fieldSize: InputSize }) =>
    getInputHeight($fieldSize)};
  font-size: ${({ $fieldSize }: { $fieldSize: InputSize }) =>
    fs(INPUT_SIZES[$fieldSize].fontSize)};
  color: ${({ $isDisabled }: Pick<StyledProps, "$isDisabled">) =>
    $isDisabled ? THEME.colors.text.secondary : THEME.colors.text.primary};
  font-family: ${Platform.select({
    ios: "Inter-Variable",
    android: "Inter-Regular",
  })};
  font-weight: ${Platform.select({
    ios: "400",
    android: "normal",
  })};
`;

const SideElement = styled.View<{ marginSide: "left" | "right" }>`
  justify-content: center;
  margin-${({ marginSide }: { marginSide: "left" | "right" }) => marginSide}: ${px(8)};
`;

const FieldNoteWrapper = styled.View`
  margin-top: ${px(4)};
`;

const ButtonContainer = styled.View<
  Pick<StyledProps, "$fieldSize" | "$isError"> & { backgroundColor?: string }
>`
  background-color: ${({
    backgroundColor,
  }: Pick<StyledProps, "$isError"> & { backgroundColor?: string }) =>
    backgroundColor || THEME.colors.background.default};
  padding: ${px(8)} 0 ${px(8)} ${px(12)};
  border-left-width: 1px;
  border-left-color: ${THEME.colors.border.default};
  height: ${({ $fieldSize }: { $fieldSize: InputSize }) =>
    getInputHeight($fieldSize)};
  align-items: center;
  justify-content: center;
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
 * @param {Object} [props.endButton] - Configuration for the end button
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
  endButton?: {
    content: string | React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    color?: string;
    backgroundColor?: string;
  };
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoFocus?: boolean;
  keyboardType?:
    | "default"
    | "number-pad"
    | "decimal-pad"
    | "numeric"
    | "email-address"
    | "phone-pad";
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      fieldSize = "lg",
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
      endButton,
      value = "",
      onChangeText,
      placeholder,
      editable = true,
      testID,
      autoCorrect = true,
      ...props
    },
    ref,
  ) => {
    const [showPassword] = useState(false);

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
          $isError={Boolean(isError || error)}
          $isDisabled={!editable}
        >
          {copyButton?.position === "left" && renderCopyButton("left")}
          {leftElement && (
            <SideElement marginSide="right">{leftElement}</SideElement>
          )}

          <StyledTextInput
            ref={ref}
            testID={testID}
            placeholder={placeholder}
            placeholderTextColor={THEME.colors.text.secondary}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            secureTextEntry={isPassword && !showPassword}
            autoCorrect={autoCorrect}
            autoFocus={props.autoFocus}
            $fieldSize={fieldSize}
            $hasLeftElement={leftElement || copyButton?.position === "left"}
            $hasRightElement={
              rightElement ||
              copyButton?.position === "right" ||
              (isPassword && !endButton)
            }
            $isDisabled={!editable}
            selection={!editable && value ? { start: 0, end: 0 } : undefined}
            {...props}
          />

          {rightElement && (
            <SideElement marginSide="left">{rightElement}</SideElement>
          )}
          {copyButton?.position === "right" && renderCopyButton("right")}
          {endButton && (
            <TouchableOpacity
              onPress={endButton.onPress}
              disabled={endButton.disabled}
              testID={testID ? `${testID}-end-button` : undefined}
            >
              <ButtonContainer
                backgroundColor={endButton.backgroundColor}
                $fieldSize={fieldSize}
              >
                {typeof endButton.content === "string" ? (
                  <Text md semiBold color={endButton.color}>
                    {endButton.content}
                  </Text>
                ) : (
                  endButton.content
                )}
              </ButtonContainer>
            </TouchableOpacity>
          )}
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
  },
);
