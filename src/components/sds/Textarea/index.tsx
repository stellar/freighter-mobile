import { THEME } from "config/theme";
import React from "react";
import { View, TextInput, StyleSheet, Text } from "react-native";

export interface TextareaProps {
  /** Number of lines the textarea should have */
  lines: number;
  /** Disabled state of the textarea */
  disabled?: boolean;
  /** Label of the textarea */
  label?: string | React.ReactNode;
  /** Adds suffix to the label */
  labelSuffix?: string | React.ReactNode;
  /** Note message of the textarea */
  note?: string | React.ReactNode;
  /** Error message of the textarea */
  error?: string | React.ReactNode;
  /** Success message of the input */
  success?: string | React.ReactNode;
  /** Make label uppercase */
  isLabelUppercase?: boolean;
}

interface Props extends TextareaProps, React.ComponentProps<typeof TextInput> {}

export const Textarea: React.FC<Props> = ({
  lines,
  label,
  labelSuffix,
  disabled,
  note,
  placeholder,
  value,
  onChangeText,
  error,
  success,
  isLabelUppercase,
}: Props) => {
  const styles = StyleSheet.create({
    container: {
      width: "100%",
    },
    textarea: {
      height: lines * 30,
      width: "100%",
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      backgroundColor: disabled
        ? THEME.colors.background.secondary
        : THEME.colors.background.default,
    },
    label: {
      color: THEME.colors.text.secondary,
      marginBottom: 8,
    },
  });

  return (
    <View style={styles.container}>
      {label && (
        <Text style={{ color: THEME.colors.text.secondary }}>
          {isLabelUppercase ? label.toString().toUpperCase() : label}
          {labelSuffix && (
            <Text style={{ color: THEME.colors.text.secondary }}>
              {" "}
              {labelSuffix}
            </Text>
          )}
        </Text>
      )}

      <TextInput
        multiline
        numberOfLines={lines}
        style={styles.textarea}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
      />
      {note && (
        <Text style={{ color: THEME.colors.text.secondary }}>{note}</Text>
      )}
      {error && (
        <Text style={{ color: THEME.colors.status.error }}>{error}</Text>
      )}
      {success && (
        <Text style={{ color: THEME.colors.status.success }}>{success}</Text>
      )}
    </View>
  );
};

Textarea.displayName = "Textarea";
