import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import React from "react";
import { TextInput } from "react-native";
import styled from "styled-components/native";

export interface TextareaProps
  extends React.ComponentProps<typeof TextInput>,
    BaseTextAreaProps {}

const TEXTAREA_SIZES = {
  sm: {
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    borderRadius: 4,
    lines: 3,
  },
  md: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 6,
    lines: 5,
  },
  lg: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderRadius: 8,
    lines: 7,
  },
} as const;

export type TextAreaSize = keyof typeof TEXTAREA_SIZES;

interface StyledProps {
  $fieldSize: TextAreaSize;
  $isError?: boolean;
  $isDisabled?: boolean;
  position?: "left" | "right";
  $variant?: "error" | "success";
}

const LINES_MULTIPLIER = 28;

const Container = styled.View<Pick<StyledProps, "$fieldSize">>`
  width: 100%;
  height: ${({ $fieldSize }: { $fieldSize: TextAreaSize }) =>
    px(TEXTAREA_SIZES[$fieldSize].lines * LINES_MULTIPLIER)};
`;

const StyledTextInput = styled.TextInput<Pick<StyledProps, "$fieldSize">>`
  flex: 1;
  background-color: ${({ $isDisabled }: Pick<StyledProps, "$isDisabled">) =>
    $isDisabled
      ? THEME.colors.background.secondary
      : THEME.colors.background.default};
  height: ${({ $fieldSize }: { $fieldSize: TextAreaSize }) =>
    px(TEXTAREA_SIZES[$fieldSize].lines * LINES_MULTIPLIER)};
  font-size: ${({ $fieldSize }: { $fieldSize: TextAreaSize }) =>
    fs(TEXTAREA_SIZES[$fieldSize].fontSize)};
  color: ${THEME.colors.text.primary};
  border-width: 1px;
  border-color: ${({ $isError }: Pick<StyledProps, "$isError">) => {
    if ($isError) {
      return THEME.colors.status.error;
    }
    return THEME.colors.border.default;
  }};
  border-radius: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(TEXTAREA_SIZES[$fieldSize].borderRadius)};
  padding-horizontal: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(TEXTAREA_SIZES[$fieldSize].paddingHorizontal)};
  padding-vertical: ${({ $fieldSize }: Pick<StyledProps, "$fieldSize">) =>
    px(TEXTAREA_SIZES[$fieldSize].paddingVertical)};
`;

const FieldNoteWrapper = styled.View`
  margin-top: ${px(8)};
`;

/**
 * Textarea component for multi-line text entry with various styling and functionality options.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Textarea
 *   value={text}
 *   onChangeText={setText}
 *   placeholder="Enter your message..."
 * />
 * ```
 *
 * @example
 * With label and validation:
 * ```tsx
 * <Textarea
 *   label="Description"
 *   labelSuffix="(required)"
 *   value={description}
 *   onChangeText={setDescription}
 *   error={!description && "Please enter a description"}
 *   fieldSize="lg"
 * />
 * ```
 *
 * @example
 * With helper text and disabled state:
 * ```tsx
 * <Textarea
 *   label="Notes"
 *   value={notes}
 *   onChangeText={setNotes}
 *   note="Add any additional information here"
 *   editable={false}
 * />
 * ```
 *
 * @example
 * With success message:
 * ```tsx
 * <Textarea
 *   label="Feedback"
 *   value={feedback}
 *   onChangeText={setFeedback}
 *   success="Thank you for your feedback!"
 *   fieldSize="md"
 * />
 * ```
 *
 * @param {TextareaProps} props - The component props
 * @param {string} [props.fieldSize="md"] - Size variant of the textarea ("sm" | "md" | "lg")
 * @param {string | ReactNode} [props.label] - Label text or component to display above the textarea
 * @param {string | ReactNode} [props.labelSuffix] - Additional text to display after the label
 * @param {boolean} [props.isLabelUppercase] - Whether to transform the label text to uppercase
 * @param {boolean} [props.isError] - Whether to show error styling
 * @param {boolean} [props.editable=true] - Whether the textarea is editable
 * @param {string | ReactNode} [props.note] - Helper text to display below the textarea
 * @param {string | ReactNode} [props.error] - Error message to display below the textarea
 * @param {string | ReactNode} [props.success] - Success message to display below the textarea
 * @param {string} props.value - The textarea value
 * @param {Function} [props.onChangeText] - Callback when text changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.testID] - Test ID for testing
 */
interface BaseTextAreaProps {
  isError?: boolean;
  testID?: string;
  editable?: boolean;
  label?: string | React.ReactNode;
  labelSuffix?: string | React.ReactNode;
  note?: string | React.ReactNode;
  error?: string | React.ReactNode;
  success?: string | React.ReactNode;
  isLabelUppercase?: boolean;
  fieldSize?: TextAreaSize;
}

export const Textarea: React.FC<TextareaProps> = ({
  testID,
  label,
  labelSuffix,
  editable = true,
  note,
  placeholder,
  value,
  onChangeText,
  error,
  success,
  isLabelUppercase,
  fieldSize = "md",
  isError,
  ...props
}: TextareaProps) => {
  const getLabelSize = () => ({
    xs: fieldSize === "sm",
    sm: fieldSize === "md",
    md: fieldSize === "lg",
  });

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

      <StyledTextInput
        testID={testID}
        $fieldSize={fieldSize}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={TEXTAREA_SIZES[fieldSize].lines}
        textAlignVertical="top"
        $isError={isError || !!error}
        $isDisabled={!editable}
        placeholderTextColor={THEME.colors.text.secondary}
        editable={editable}
        {...props}
      />

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

Textarea.displayName = "Textarea";
