import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Clipboard from "@react-native-clipboard/clipboard";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { isAndroid } from "helpers/device";
import { fsValue } from "helpers/dimensions";
import React, { useState, useMemo } from "react";
import {
  TouchableOpacity,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";

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
    ? {
        sm: "rounded-l",
        md: "rounded-l-md",
        lg: "rounded-l-lg",
      }
    : {
        sm: "rounded",
        md: "rounded-md",
        lg: "rounded-lg",
      };

  return `${baseClasses} ${backgroundColor} ${borders} ${borderRadius[fieldSize]}`;
};

const getIOSInputClasses = (isDisabled?: boolean) => {
  const baseClasses = "flex-1";
  const textColor = isDisabled ? "text-text-secondary" : "text-text-primary";
  const textAlign = "text-left";

  return `${baseClasses} ${textColor} ${textAlign}`;
};

const getAndroidInputClasses = (isDisabled?: boolean) => {
  const baseClasses = "flex-1";
  const textColor = isDisabled ? "text-text-secondary" : "text-text-primary";
  const textAlign = "text-left";

  return `${baseClasses} ${textColor} ${textAlign}`;
};

const getInputClasses = (isDisabled?: boolean) =>
  isAndroid
    ? getAndroidInputClasses(isDisabled)
    : getIOSInputClasses(isDisabled);

const getIOSInputStyles = (fieldSize: InputSize) => {
  const fontSizeMap = {
    sm: fsValue(12),
    md: fsValue(14),
    lg: fsValue(16),
  };

  return {
    fontSize: fontSizeMap[fieldSize],
    fontFamily: "Inter-Variable",
    fontWeight: "400" as const,
  };
};

const getAndroidInputStyles = (fieldSize: InputSize) => {
  const fontSizeMap = {
    sm: fsValue(12),
    md: fsValue(14),
    lg: fsValue(16),
  };

  return {
    fontSize: fontSizeMap[fieldSize],
    fontFamily: "Inter-Regular",
    fontWeight: "400" as const,
    textAlignVertical: "center" as const,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
  };
};

const getInputStyles = (fieldSize: InputSize) =>
  isAndroid ? getAndroidInputStyles(fieldSize) : getIOSInputStyles(fieldSize);

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

  const borderRadius = {
    sm: "rounded-r",
    md: "rounded-r-md",
    lg: "rounded-r-lg",
  };

  return `${bgColor} ${border} ${borderRadius[fieldSize]} items-center justify-center`;
};

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
 * @param {ViewStyle | TextStyle} [props.style] - Custom style to override default styling
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
  selectTextOnFocus?: boolean;
}

type InputRef = TextInput | React.ComponentRef<typeof BottomSheetTextInput>;

interface TextInputComponentProps {
  fieldSize?: InputSize;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  autoCorrect?: boolean;
  isBottomSheetInput?: boolean;
  testID?: string;
  style?: ViewStyle | TextStyle;
  className?: string;
  ref: React.Ref<InputRef>;
  onSubmitEditing?: () => void;
  selectTextOnFocus?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoFocus?: boolean;
  keyboardType?:
    | "default"
    | "number-pad"
    | "decimal-pad"
    | "numeric"
    | "email-address"
    | "phone-pad";
  selection?: { start: number; end: number };
}

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
        className={inputClasses}
        style={[inputStyles, style]}
        {...props}
      />
    );
  },
);

export const StyledTextInput = React.forwardRef<InputRef, InputProps>(
  (props, ref) => {
    const { fieldSize = "lg", style, ...restProps } = props;

    const containerClasses = `rounded-lg bg-background-default border border-border-primary rounded ${CONTAINER_HEIGHT_MAP[fieldSize]} ${HORIZONTAL_PADDING_MAP[fieldSize]} flex-1`;

    const { testID, ...textInputProps } = restProps;

    return (
      <View testID={testID} className={containerClasses} style={style}>
        <TextInputComponent
          ref={ref}
          fieldSize={fieldSize}
          {...textInputProps}
        />
      </View>
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
      copyButton,
      endButton,
      value = "",
      onChangeText,
      placeholder,
      editable = true,
      testID,
      autoCorrect = true,
      isBottomSheetInput = false,
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

    // Hardcoded values - no dynamic calculations needed

    // Hardcoded padding classes for container
    const containerPaddingClasses = useMemo(() => {
      // Hardcoded padding values based on field size
      let paddingLeft = "pl-[14px]"; // default lg
      if (fieldSize === "sm") paddingLeft = "pl-[10px]";
      else if (fieldSize === "md") paddingLeft = "pl-[12px]";

      let paddingRight = "";
      // Add right padding when there's no endButton (endButton takes up the right space)
      if (!endButton) {
        if (fieldSize === "sm") paddingRight = "pr-[10px]";
        else if (fieldSize === "md") paddingRight = "pr-[12px]";
        else paddingRight = "pr-[14px]";
      }

      return `${paddingLeft} ${paddingRight}`.trim();
    }, [fieldSize, endButton]);

    const buttonPaddingClasses = useMemo(
      () => "pt-[8px] pb-[8px] pl-[12px] pr-[12px]",
      [],
    );

    const heightClasses = CONTAINER_HEIGHT_MAP[fieldSize];

    const renderCopyButton = () => (
      <TouchableOpacity onPress={handleCopy}>
        <View className={getSideElementClasses(fieldSize)}>
          <Text sm>{copyButton?.showLabel ? "Copy" : "📋"}</Text>
        </View>
      </TouchableOpacity>
    );

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
            {copyButton?.position === "left" && renderCopyButton()}
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
              selection={!editable && value ? { start: 0, end: 0 } : undefined}
              {...props}
            />

            {rightElement && (
              <View className={rightSideElementClasses}>{rightElement}</View>
            )}
            {copyButton?.position === "right" && renderCopyButton()}
          </View>

          {endButton && (
            <TouchableOpacity
              onPress={endButton.onPress}
              disabled={endButton.disabled}
              testID={testID ? `${testID}-end-button` : undefined}
              className="flex-shrink-0"
            >
              <View
                className={`${buttonContainerClasses} ${buttonPaddingClasses} ${heightClasses} mr-[4px]`}
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
