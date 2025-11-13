import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { isAndroid } from "helpers/device";
import { fsValue } from "helpers/dimensions";
import { useClipboard } from "hooks/useClipboard";
import { t } from "i18next";
import React, { useState, useMemo } from "react";
import {
  TouchableOpacity,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";

/**
 * Size variants for input components.
 *
 * @typedef {"sm" | "md" | "lg"} InputSize
 * @property {"sm"} sm - Small size (30px height)
 * @property {"md"} md - Medium size (38px height)
 * @property {"lg"} lg - Large size (48px height)
 */
export type InputSize = "sm" | "md" | "lg";

type ClassNameMap = Record<InputSize, string>;

const CONTAINER_HEIGHT_MAP: ClassNameMap = {
  sm: "h-[30px]",
  md: "h-[38px]",
  lg: "h-[48px]",
};

const VERTICAL_PADDING_MAP: ClassNameMap = {
  sm: "py-1", // paddingVertical(4)
  md: "py-1.5", // paddingVertical(6)
  lg: "py-2", // paddingVertical(8)
};

const HORIZONTAL_PADDING_MAP: ClassNameMap = {
  sm: "pl-[10px] pr-[10px]",
  md: "pl-[12px] pr-[12px]",
  lg: "pl-[12px] pr-[12px]",
};

const GAP_MAP: ClassNameMap = {
  sm: "gap-1.5",
  md: "gap-1.5",
  lg: "gap-2",
};

const FONT_SIZE_MAP = {
  sm: fsValue(12),
  md: fsValue(14),
  lg: fsValue(16),
} as const;

// Border radius maps
const BORDER_RADIUS_MAP: ClassNameMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
};

const BORDER_RADIUS_LEFT_MAP: ClassNameMap = {
  sm: "rounded-l",
  md: "rounded-l-md",
  lg: "rounded-l-lg",
};

const BORDER_RADIUS_RIGHT_MAP: ClassNameMap = {
  sm: "rounded-r",
  md: "rounded-r-md",
  lg: "rounded-r-lg",
};

// Label size mapping - direct mapping to Text component props
const LABEL_SIZE_MAP = {
  sm: "xs",
  md: "sm",
  lg: "md",
} as const;

// Container padding maps
const CONTAINER_PADDING_LEFT_MAP: ClassNameMap = {
  sm: "pl-[10px]",
  md: "pl-[12px]",
  lg: "pl-[14px]",
};

const CONTAINER_PADDING_RIGHT_MAP: ClassNameMap = {
  sm: "pr-[10px]",
  md: "pr-[12px]",
  lg: "pr-[14px]",
};

const getInputContainerClasses = (
  fieldSize: InputSize,
  isError?: boolean,
  isDisabled?: boolean,
  hasEndButton?: boolean,
) => {
  const baseClasses = "flex-row items-center";
  const backgroundColor = isDisabled
    ? "bg-background-secondary"
    : "bg-background-primary";

  const borderColor = isError ? "border-status-error" : "border-border-primary";

  const borders = hasEndButton
    ? `border-t border-b border-l ${borderColor}`
    : `border ${borderColor}`;

  const borderRadius = hasEndButton
    ? BORDER_RADIUS_LEFT_MAP[fieldSize]
    : BORDER_RADIUS_MAP[fieldSize];

  return `${baseClasses} ${backgroundColor} ${borders} ${borderRadius}`;
};

const getInputClasses = (isDisabled?: boolean) => {
  const baseClasses = "flex-1 w-full";
  const textColor = isDisabled ? "text-text-secondary" : "text-text-primary";
  const textAlign = "text-left";

  return `${baseClasses} ${textColor} ${textAlign}`;
};

const getInputStyles = (fieldSize: InputSize) => {
  const baseStyles = {
    fontSize: FONT_SIZE_MAP[fieldSize],
  };

  if (isAndroid) {
    return {
      ...baseStyles,
      fontFamily: "Inter-Regular",
      fontWeight: "400" as const,
      textAlignVertical: "center" as const,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
    };
  }

  return {
    ...baseStyles,
    fontFamily: "Inter-Variable",
    fontWeight: "400" as const,
  };
};

const getSideElementClasses = (fieldSize: InputSize) =>
  `${CONTAINER_HEIGHT_MAP[fieldSize]} justify-center items-center mt-[2px]`;

const getFieldNoteWrapperClasses = () => "mt-1";

const getButtonContainerClasses = (
  fieldSize: InputSize,
  backgroundColor?: string,
  isError?: boolean,
) => {
  const bgColor = backgroundColor ? "" : "bg-background-primary";
  const borderColor = isError ? "border-status-error" : "border-border-primary";
  const border = `border-l border-t border-b border-r ${borderColor}`;

  return `${bgColor} ${border} ${BORDER_RADIUS_RIGHT_MAP[fieldSize]} items-center justify-center`;
};

// Helper functions for suffix input styling
/**
 * Generates CSS classes for the suffix input container.
 *
 * @param {InputSize} fieldSize - The size variant of the input field
 * @returns {string} CSS classes for the suffix container
 */
const getSuffixContainerClasses = (fieldSize: InputSize) => {
  const height = CONTAINER_HEIGHT_MAP[fieldSize];
  const padding = HORIZONTAL_PADDING_MAP[fieldSize];
  return `flex-1 flex-row items-center ${height} ${padding}`;
};

/**
 * Generates text styles for suffix input text elements.
 *
 * @param {InputSize} fieldSize - The size variant of the input field
 * @returns {Object} Style object for suffix text elements
 */
const getSuffixTextStyles = (fieldSize: InputSize) => ({
  fontSize: FONT_SIZE_MAP[fieldSize],
  color: THEME.colors.text.primary,
  fontFamily: Platform.select({
    ios: "Inter-Variable",
    android: "Inter-Regular",
  }),
  fontWeight: Platform.select({
    ios: "400" as const,
    android: "normal" as const,
  }),
});

/**
 * Custom hook that provides common input functionality and styling logic.
 * Consolidates shared logic between Input and SuffixInput components.
 *
 * @param {InputSize} fieldSize - The size variant of the input field
 * @param {string} value - The current input value
 * @param {boolean} [isError] - Whether the input is in an error state
 * @param {string | React.ReactNode} [error] - Error message to display
 * @param {boolean} [editable] - Whether the input is editable
 * @param {Object} [endButton] - Configuration for the end button
 * @returns {Object} Object containing styling classes and utility functions
 * @returns {Function} returns.renderCopyButton - Function to render the copy button
 * @returns {Function} returns.getLabelSize - Function to get label size props
 * @returns {string} returns.containerClasses - CSS classes for the container
 * @returns {string} returns.inputContainerClasses - CSS classes for the input container
 * @returns {string} returns.leftSideElementClasses - CSS classes for left side elements
 * @returns {string} returns.rightSideElementClasses - CSS classes for right side elements
 * @returns {string} returns.fieldNoteClasses - CSS classes for field notes
 * @returns {string} returns.buttonContainerClasses - CSS classes for button container
 * @returns {string} returns.containerPaddingClasses - CSS classes for container padding
 * @returns {string} returns.buttonPaddingClasses - CSS classes for button padding
 * @returns {string} returns.heightClasses - CSS classes for height
 */
const useInputCommon = (
  fieldSize: InputSize,
  value: string,
  isError?: boolean,
  error?: string | React.ReactNode,
  editable?: boolean,
  endButton?: InputProps["endButton"],
) => {
  const { copyToClipboard } = useClipboard();

  const renderCopyButton = useMemo(
    () => () => (
      <TouchableOpacity
        onPress={() => {
          copyToClipboard(value);
        }}
      >
        <View className={getSideElementClasses(fieldSize)}>
          <Text sm>{t("common.copy")}</Text>
        </View>
      </TouchableOpacity>
    ),
    [fieldSize, copyToClipboard, value],
  );

  const containerClasses = useMemo(
    () => `w-full ${GAP_MAP[fieldSize]}`,
    [fieldSize],
  );

  const inputContainerClasses = useMemo(
    () =>
      `${getInputContainerClasses(fieldSize, Boolean(isError || error), !editable, Boolean(endButton))} ${VERTICAL_PADDING_MAP[fieldSize]}`,
    [fieldSize, isError, error, editable, endButton],
  );

  const leftSideElementClasses = useMemo(
    () => `${getSideElementClasses(fieldSize)} mr-2`,
    [fieldSize],
  );

  const rightSideElementClasses = useMemo(
    () => getSideElementClasses(fieldSize),
    [fieldSize],
  );

  const fieldNoteClasses = useMemo(() => getFieldNoteWrapperClasses(), []);

  const buttonContainerClasses = useMemo(
    () =>
      getButtonContainerClasses(
        fieldSize,
        endButton?.backgroundColor,
        Boolean(isError || error),
      ),
    [fieldSize, endButton?.backgroundColor, isError, error],
  );

  const containerPaddingClasses = useMemo(() => {
    const paddingLeft = CONTAINER_PADDING_LEFT_MAP[fieldSize];
    const paddingRight = !endButton
      ? CONTAINER_PADDING_RIGHT_MAP[fieldSize]
      : "";
    return `${paddingLeft} ${paddingRight}`.trim();
  }, [fieldSize, endButton]);

  const buttonPaddingClasses = useMemo(
    () => "pt-[8px] pb-[8px] pl-[12px] pr-[12px]",
    [],
  );

  const heightClasses = CONTAINER_HEIGHT_MAP[fieldSize];

  const getLabelSize = () => ({ [LABEL_SIZE_MAP[fieldSize]]: true });

  return {
    renderCopyButton,
    getLabelSize,
    containerClasses,
    inputContainerClasses,
    leftSideElementClasses,
    rightSideElementClasses,
    fieldNoteClasses,
    buttonContainerClasses,
    containerPaddingClasses,
    buttonPaddingClasses,
    heightClasses,
  };
};

// Define InputProps first since TextInputComponentProps references it
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
  copyButtonPosition?: "left" | "right";
  endButton?: {
    content: string | React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    color?: string;
    backgroundColor?: string;
  };
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
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
  isBottomSheetInput?: boolean;
  style?: ViewStyle | TextStyle;
  /** Text to display as suffix after the input value (e.g., "XLM") */
  inputSuffixDisplay?: string;
  /** Whether to center the text alignment within the input field */
  centered?: boolean;
  /** Line break mode for iOS */
  lineBreakModeIOS?: "head" | "middle" | "tail" | "clip";
}

/**
 * Reference type for input components.
 * Can be either a TextInput or BottomSheetTextInput component reference.
 *
 * @typedef {TextInput | React.ComponentRef<typeof BottomSheetTextInput>} InputRef
 */
type InputRef = TextInput | React.ComponentRef<typeof BottomSheetTextInput>;

/**
 * Props interface for the TextInputComponent.
 * Contains only the core text input properties needed for the base component.
 *
 * @typedef {Object} TextInputComponentProps
 * @property {string} [fieldSize] - Size variant of the input field
 * @property {string} [value] - The input value
 * @property {Function} [onChangeText] - Callback when text changes
 * @property {string} [placeholder] - Placeholder text
 * @property {string} [placeholderTextColor] - Color of the placeholder text
 * @property {boolean} [secureTextEntry] - Whether the input is for password entry
 * @property {boolean} [editable] - Whether the input is editable
 * @property {string} [autoCapitalize] - Text capitalization behavior
 * @property {boolean} [autoCorrect] - Whether to enable auto-correction
 * @property {boolean} [autoFocus] - Whether to focus the input on mount
 * @property {string} [keyboardType] - Keyboard type for the input
 * @property {boolean} [isBottomSheetInput] - Whether to use BottomSheetTextInput
 * @property {string} [testID] - Test ID for testing
 * @property {ViewStyle | TextStyle} [style] - Custom style to override default styling
 * @property {Function} [onSubmitEditing] - Callback when editing is submitted
 * @property {Object} [selection] - Text selection range
 * @property {string} [className] - Additional CSS classes
 * @property {React.Ref<InputRef>} ref - Reference to the input component
 */
type TextInputComponentProps = Pick<
  InputProps,
  | "fieldSize"
  | "value"
  | "onChangeText"
  | "placeholder"
  | "placeholderTextColor"
  | "secureTextEntry"
  | "editable"
  | "autoCorrect"
  | "isBottomSheetInput"
  | "testID"
  | "style"
  | "onSubmitEditing"
  | "autoCapitalize"
  | "autoFocus"
  | "keyboardType"
  | "lineBreakModeIOS"
> & {
  className?: string;
  ref: React.Ref<InputRef>;
  selection?: { start: number; end: number };
};

/**
 * Core text input component that handles both regular TextInput and BottomSheetTextInput.
 * Provides the base functionality for all input components with NativeWind styling.
 *
 * @param {TextInputComponentProps} props - The component props
 * @param {string} [props.fieldSize="lg"] - Size variant of the input field
 * @param {string} props.value - The input value
 * @param {Function} [props.onChangeText] - Callback when text changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.placeholderTextColor] - Color of the placeholder text
 * @param {boolean} [props.secureTextEntry=false] - Whether the input is for password entry
 * @param {boolean} [props.editable=true] - Whether the input is editable
 * @param {boolean} [props.autoCorrect=true] - Whether to enable auto-correction
 * @param {boolean} [props.isBottomSheetInput=false] - Whether to use BottomSheetTextInput
 * @param {string} [props.testID] - Test ID for testing
 * @param {ViewStyle | TextStyle} [props.style] - Custom style to override default styling
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} The TextInputComponent
 */
const TextInputComponent = React.forwardRef<InputRef, TextInputComponentProps>(
  (
    {
      fieldSize = "lg",
      value,
      onChangeText,
      placeholder,
      placeholderTextColor = THEME.colors.text.secondary,
      secureTextEntry = false,
      editable = true,
      autoCorrect = true,
      isBottomSheetInput = false,
      testID,
      style,
      className,
      lineBreakModeIOS,
      ...props
    },
    ref,
  ) => {
    const inputClasses = useMemo(() => getInputClasses(!editable), [editable]);

    const inputStyles = useMemo(() => getInputStyles(fieldSize), [fieldSize]);

    if (isBottomSheetInput) {
      return (
        <BottomSheetTextInput
          ref={
            ref as React.Ref<React.ComponentRef<typeof BottomSheetTextInput>>
          }
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCorrect={autoCorrect}
          lineBreakModeIOS={lineBreakModeIOS}
          className={inputClasses}
          style={[inputStyles, style]}
          {...props}
        />
      );
    }

    return (
      <TextInput
        ref={ref as React.Ref<TextInput>}
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={secureTextEntry}
        autoCorrect={autoCorrect}
        lineBreakModeIOS={lineBreakModeIOS}
        className={inputClasses}
        style={[inputStyles, style]}
        {...props}
      />
    );
  },
);

/**
 * Specialized input component that displays a suffix text after the input value.
 * Useful for inputs that need to show units (e.g., "XLM", "USD") or other contextual information.
 * The suffix is displayed as overlay text while maintaining full input functionality.
 *
 * @example
 * Basic suffix input:
 * ```tsx
 * <SuffixInput
 *   label="Amount"
 *   value={amount}
 *   onChangeText={setAmount}
 *   inputSuffixDisplay="XLM"
 *   placeholder="0.00"
 * />
 * ```
 *
 * @example
 * Centered suffix input:
 * ```tsx
 * <SuffixInput
 *   label="Price"
 *   value={price}
 *   onChangeText={setPrice}
 *   inputSuffixDisplay="USD"
 *   centered
 *   placeholder="0.00"
 * />
 * ```
 *
 * @param {InputProps} props - The component props (same as Input component)
 * @param {string} [props.inputSuffixDisplay] - Text to display as suffix after the input value
 * @param {boolean} [props.centered=false] - Whether to center the text alignment within the input field
 * @returns {JSX.Element} The SuffixInput component
 */
const SuffixInput = React.forwardRef<InputRef, InputProps>(
  (
    {
      fieldSize = "lg",
      label,
      labelSuffix,
      isLabelUppercase,
      isError,
      leftElement,
      rightElement,
      note,
      error,
      success,
      copyButtonPosition,
      endButton,
      value = "",
      onChangeText,
      placeholder,
      editable = true,
      testID,
      autoCorrect = true,
      inputSuffixDisplay,
      centered = false,
      ...props
    },
    ref,
  ) => {
    // Use the common hook
    const {
      renderCopyButton,
      getLabelSize,
      containerClasses,
      inputContainerClasses,
      leftSideElementClasses,
      rightSideElementClasses,
      fieldNoteClasses,
      buttonContainerClasses,
      containerPaddingClasses,
      buttonPaddingClasses,
      heightClasses,
    } = useInputCommon(fieldSize, value, isError, error, editable, endButton);

    const commonTextInputProps = {
      ref,
      testID,
      placeholder,
      placeholderTextColor: THEME.colors.text.secondary,
      value,
      onChangeText,
      editable,
      autoCorrect,
      autoFocus: props.autoFocus,
      fieldSize,
      selection: !editable && value ? { start: 0, end: 0 } : undefined,
      ...props,
    };

    return (
      <View className={containerClasses}>
        {label && (
          <Text {...getLabelSize()} sm color={THEME.colors.text.secondary}>
            {isLabelUppercase ? label.toString().toUpperCase() : label}
            {labelSuffix && (
              <Text {...getLabelSize()} color={THEME.colors.text.secondary}>
                {" "}
                {labelSuffix}
              </Text>
            )}
          </Text>
        )}

        <View className="flex-row items-center">
          <View
            testID={testID ? `${testID}-container` : undefined}
            className={`${inputContainerClasses} ${containerPaddingClasses} ${heightClasses} flex-1`}
          >
            {copyButtonPosition === "left" && renderCopyButton()}
            {leftElement && (
              <View className={leftSideElementClasses}>{leftElement}</View>
            )}

            <View className={getSuffixContainerClasses(fieldSize)}>
              <View
                className={`flex-1 flex-row items-center ${centered ? "justify-center" : "justify-start"} ${value ? "flex" : "hidden"}`}
              >
                <Text style={getSuffixTextStyles(fieldSize)}>
                  {value || ""}
                </Text>
                <Text style={getSuffixTextStyles(fieldSize)}>
                  {inputSuffixDisplay}
                </Text>
              </View>

              <TextInputComponent
                {...commonTextInputProps}
                fieldSize={fieldSize}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: "transparent",
                  color: "transparent",
                  textAlign: centered ? "center" : "left",
                }}
              />
            </View>

            {rightElement && (
              <View className={rightSideElementClasses}>{rightElement}</View>
            )}
            {copyButtonPosition === "right" && renderCopyButton()}
          </View>

          {endButton && (
            <TouchableOpacity
              onPress={endButton.onPress}
              disabled={endButton.disabled}
              testID={testID ? `${testID}-end-button` : undefined}
              className="flex-shrink-0"
            >
              <View
                className={`${buttonContainerClasses} ${buttonPaddingClasses} ${heightClasses}`}
                style={{
                  backgroundColor:
                    endButton.backgroundColor ||
                    THEME.colors.background.default,
                }}
              >
                {typeof endButton.content === "string" ? (
                  <Text
                    md
                    semiBold
                    color={endButton.color}
                    isVerticallyCentered
                  >
                    {endButton.content}
                  </Text>
                ) : (
                  endButton.content
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {note && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.text.secondary}>
              {note}
            </Text>
          </View>
        )}
        {error && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.status.error}>
              {error}
            </Text>
          </View>
        )}
        {success && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.status.success}>
              {success}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

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
 *   copyButtonPosition="right"
 *   note="Click the copy button to copy the address"
 *   editable={false}
 * />
 * ```
 *
 * @example
 * With suffix display (automatically uses SuffixInput):
 * ```tsx
 * <Input
 *   label="Amount"
 *   value={amount}
 *   onChangeText={setAmount}
 *   inputSuffixDisplay="XLM"
 *   placeholder="0.00"
 * />
 * ```
 *
 * @param {InputProps} props - The component props
 * @param {string} [props.fieldSize="lg"] - Size variant of the input field ("sm" | "md" | "lg")
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
 * @param {"left" | "right"} [props.copyButtonPosition] - Configuration for the copy button
 * @param {Object} [props.endButton] - Configuration for the end button
 * @param {string} props.value - The input value
 * @param {Function} [props.onChangeText] - Callback when text changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.editable=true] - Whether the input is editable
 * @param {string} [props.testID] - Test ID for testing
 * @param {("none" | "sentences" | "words" | "characters")} [props.autoCapitalize] - Text capitalization behavior
 * @param {("default" | "number-pad" | "decimal-pad" | "numeric" | "email-address" | "phone-pad")} [props.keyboardType] - Keyboard type for the input
 * @param {ViewStyle | TextStyle} [props.style] - Custom style to override default styling
 * @param {boolean} [props.isBottomSheetInput] - Whether the input is a bottom sheet input
 * @param {string} [props.inputSuffixDisplay] - Text to display as suffix after the input value (e.g., "XLM"). When provided, automatically uses SuffixInput component
 * @param {boolean} [props.centered] - Whether to center the text alignment within the input field (only applies when inputSuffixDisplay is provided)
 */

/**
 * A styled text input component with basic container styling.
 * Provides a simple wrapper around TextInputComponent with predefined styling.
 *
 * @param {InputProps} props - The component props
 * @param {string} [props.fieldSize="lg"] - Size variant of the input field
 * @param {ViewStyle | TextStyle} [props.style] - Custom style to override default styling
 * @returns {JSX.Element} The StyledTextInput component
 */
export const StyledTextInput = React.forwardRef<InputRef, InputProps>(
  (props, ref) => {
    const { fieldSize = "lg", style, ...restProps } = props;

    return (
      <TextInputComponent
        ref={ref}
        fieldSize={fieldSize}
        style={style}
        {...restProps}
      />
    );
  },
);

export const Input = React.forwardRef<InputRef, InputProps>(
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
      copyButtonPosition,
      endButton,
      value = "",
      onChangeText,
      placeholder,
      editable = true,
      testID,
      autoCorrect = true,
      isBottomSheetInput = false,
      inputSuffixDisplay,
      centered = false,
      style,
      ...props
    },
    ref,
  ) => {
    const [showPassword] = useState(false);

    // Use the common hook
    const {
      renderCopyButton,
      getLabelSize,
      containerClasses,
      inputContainerClasses,
      leftSideElementClasses,
      rightSideElementClasses,
      fieldNoteClasses,
      buttonContainerClasses,
      containerPaddingClasses,
      buttonPaddingClasses,
      heightClasses,
    } = useInputCommon(fieldSize, value, isError, error, editable, endButton);

    // If inputSuffixDisplay is provided, use the separate SuffixInput component
    if (inputSuffixDisplay) {
      return (
        <SuffixInput
          ref={ref}
          fieldSize={fieldSize}
          label={label}
          labelSuffix={labelSuffix}
          isLabelUppercase={isLabelUppercase}
          isError={isError}
          leftElement={leftElement}
          rightElement={rightElement}
          note={note}
          error={error}
          success={success}
          copyButtonPosition={copyButtonPosition}
          endButton={endButton}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={editable}
          testID={testID}
          autoCorrect={autoCorrect}
          isBottomSheetInput={isBottomSheetInput}
          inputSuffixDisplay={inputSuffixDisplay}
          centered={centered}
          style={style}
          {...props}
        />
      );
    }

    return (
      <View className={containerClasses}>
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

        <View className="flex-row items-center">
          <View
            testID={testID ? `${testID}-container` : undefined}
            className={`${inputContainerClasses} ${containerPaddingClasses} ${heightClasses} flex-1`}
          >
            {copyButtonPosition === "left" && renderCopyButton()}
            {leftElement && (
              <View className={leftSideElementClasses}>{leftElement}</View>
            )}

            <TextInputComponent
              ref={ref}
              fieldSize={fieldSize}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={THEME.colors.text.secondary}
              secureTextEntry={isPassword && !showPassword}
              editable={editable}
              autoCorrect={autoCorrect}
              isBottomSheetInput={isBottomSheetInput}
              testID={testID}
              style={style}
              selection={!editable && value ? { start: 0, end: 0 } : undefined}
              {...props}
            />

            {rightElement && (
              <View className={rightSideElementClasses}>{rightElement}</View>
            )}
            {copyButtonPosition === "right" && renderCopyButton()}
          </View>

          {endButton && (
            <TouchableOpacity
              onPress={endButton.onPress}
              disabled={endButton.disabled}
              testID={testID ? `${testID}-end-button` : undefined}
              className="flex-shrink-0"
            >
              <View
                className={`${buttonContainerClasses} ${buttonPaddingClasses} ${heightClasses}`}
                style={{
                  backgroundColor:
                    endButton.backgroundColor ||
                    THEME.colors.background.default,
                }}
              >
                {typeof endButton.content === "string" ? (
                  <Text
                    md
                    semiBold
                    color={endButton.color}
                    isVerticallyCentered
                  >
                    {endButton.content}
                  </Text>
                ) : (
                  endButton.content
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {note && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.text.secondary}>
              {note}
            </Text>
          </View>
        )}
        {error && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.status.error}>
              {error}
            </Text>
          </View>
        )}
        {success && (
          <View className={fieldNoteClasses}>
            <Text sm color={THEME.colors.status.success}>
              {success}
            </Text>
          </View>
        )}
      </View>
    );
  },
);
