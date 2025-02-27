import Clipboard from "@react-native-clipboard/clipboard";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity } from "react-native";
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

export interface InputProps {
  id?: string;
  fieldSize?: InputSize;
  label?: string | React.ReactNode;
  labelSuffix?: string | React.ReactNode;
  isLabelUppercase?: boolean;
  isError?: boolean;
  isPassword?: boolean;
  leftElement?: JSX.Element;
  rightElement?: JSX.Element;
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
  ...props
}) => {
  const handleCopy = () => {
    if (!value) {
      return;
    }

    Clipboard.setString(value);
  };

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
        <Text
          sm={fieldSize === "sm"}
          md={fieldSize === "md"}
          lg={fieldSize === "lg"}
          color={THEME.colors.text.primary}
        >
          {isLabelUppercase ? label.toString().toUpperCase() : label}
          {labelSuffix && (
            <Text color={THEME.colors.text.secondary}> {labelSuffix}</Text>
          )}
        </Text>
      )}

      <InputContainer
        $fieldSize={fieldSize}
        $isError={isError || !!error}
        $isDisabled={!editable}
      >
        {copyButton?.position === "left" && renderCopyButton("left")}
        {leftElement && (
          <SideElement position="left">{leftElement}</SideElement>
        )}

        <StyledTextInput
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
