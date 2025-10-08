import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fsValue } from "helpers/dimensions";
import React, { useMemo } from "react";
import { Platform, TextInput, View, TextStyle } from "react-native";

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
    lines: 2,
  },
  md: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 6,
    lines: 3,
  },
  lg: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderRadius: 8,
    lines: 4,
  },
} as const;

export type TextAreaSize = keyof typeof TEXTAREA_SIZES;

const LINES_MULTIPLIER = 28;

type ClassNameMap = Record<TextAreaSize, string>;

const CONTAINER_GAP_MAP: ClassNameMap = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2",
};

const BORDER_RADIUS_MAP: ClassNameMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
};

const HORIZONTAL_PADDING_MAP: ClassNameMap = {
  sm: "px-[10px]",
  md: "px-[12px]",
  lg: "px-[14px]",
};

const VERTICAL_PADDING_MAP: ClassNameMap = {
  sm: "py-[6px]",
  md: "py-[8px]",
  lg: "py-[10px]",
};

const LABEL_SIZE_MAP = {
  sm: "xs",
  md: "sm",
  lg: "md",
} as const;

const getContainerClasses = (fieldSize: TextAreaSize): string =>
  `w-full ${CONTAINER_GAP_MAP[fieldSize]}`;

const getTextAreaContainerClasses = (fieldSize: TextAreaSize): string =>
  `w-full h-[${TEXTAREA_SIZES[fieldSize].lines * LINES_MULTIPLIER}px]`;

const getTextAreaClasses = (
  fieldSize: TextAreaSize,
  isError?: boolean,
  isDisabled?: boolean,
): string => {
  const baseClasses = "w-full";
  const backgroundColor = isDisabled
    ? "bg-background-secondary"
    : "bg-background-primary";
  const borderColor = isError ? "border-status-error" : "border-border-primary";
  const borderRadius = BORDER_RADIUS_MAP[fieldSize];
  const paddingHorizontal = HORIZONTAL_PADDING_MAP[fieldSize];
  const paddingVertical = VERTICAL_PADDING_MAP[fieldSize];
  const textColor = "text-text-primary";

  return `${baseClasses} ${backgroundColor} ${borderColor} ${borderRadius} ${paddingHorizontal} ${paddingVertical} ${textColor} border`;
};

const getTextAreaStyles = (fieldSize: TextAreaSize): TextStyle => {
  const height = TEXTAREA_SIZES[fieldSize].lines * LINES_MULTIPLIER;

  return {
    height,
    fontSize: fsValue(TEXTAREA_SIZES[fieldSize].fontSize),
    fontFamily: Platform.select({
      ios: "Inter-Variable",
      android: "Inter-Regular",
    }),
    fontWeight: Platform.select({
      ios: "400",
      android: "normal",
    }),
  };
};

const getLabelProps = (fieldSize: TextAreaSize) => ({
  [LABEL_SIZE_MAP[fieldSize]]: true,
});

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
  const containerClasses = useMemo(
    () => getContainerClasses(fieldSize),
    [fieldSize],
  );

  const textAreaContainerClasses = useMemo(
    () => getTextAreaContainerClasses(fieldSize),
    [fieldSize],
  );

  const textAreaClasses = useMemo(
    () => getTextAreaClasses(fieldSize, isError || !!error, !editable),
    [fieldSize, isError, error, editable],
  );

  const textAreaStyles = useMemo(
    () => getTextAreaStyles(fieldSize),
    [fieldSize],
  );

  const labelProps = useMemo(() => getLabelProps(fieldSize), [fieldSize]);

  return (
    <View className={containerClasses}>
      {label && (
        <Text {...labelProps} color={THEME.colors.text.secondary}>
          {isLabelUppercase ? label.toString().toUpperCase() : label}
          {labelSuffix && (
            <Text {...labelProps} color={THEME.colors.text.secondary}>
              {" "}
              {labelSuffix}
            </Text>
          )}
        </Text>
      )}

      <View className={textAreaContainerClasses}>
        <TextInput
          testID={testID}
          className={textAreaClasses}
          style={textAreaStyles}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline
          numberOfLines={TEXTAREA_SIZES[fieldSize].lines}
          textAlignVertical="top"
          placeholderTextColor={THEME.colors.text.secondary}
          editable={editable}
          {...props}
        />
      </View>

      {note && (
        <View className="mt-2">
          {typeof note === "string" ? (
            <Text sm color={THEME.colors.text.secondary}>
              {note}
            </Text>
          ) : (
            note
          )}
        </View>
      )}
      {error && (
        <View className="mt-2">
          <Text sm color={THEME.colors.status.error}>
            {error}
          </Text>
        </View>
      )}
      {success && (
        <View className="mt-2">
          <Text sm color={THEME.colors.status.success}>
            {success}
          </Text>
        </View>
      )}
    </View>
  );
};

Textarea.displayName = "Textarea";
