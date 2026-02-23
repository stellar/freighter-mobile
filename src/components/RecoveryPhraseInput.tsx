import { Textarea, TextareaProps } from "components/sds/Textarea";
import {
  normalizeAndTrimRecoveryPhrase,
  normalizeRecoveryPhrase,
} from "helpers/recoveryPhrase";
import React, { useState, useEffect } from "react";

export interface RecoveryPhraseInputProps
  extends Omit<TextareaProps, "value" | "onChangeText"> {
  value: string;
  showMasked?: boolean;
  setValue: (text: string) => void;
}

export const RecoveryPhraseInput: React.FC<RecoveryPhraseInputProps> = ({
  value,
  showMasked = true,
  onFocus,
  onBlur,
  setValue,
  testID,
  ...restProps
}) => {
  // Mask function (customize as needed)
  const maskText = (text: string) => text.replace(/\S/g, "*"); // replace every non-space with *

  const [actualValue, setActualValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(
    showMasked ? maskText(value) : value,
  );

  // Update internal state when value prop changes
  useEffect(() => {
    setActualValue(value);
    setDisplayValue(showMasked ? maskText(value) : value);
  }, [value, showMasked]);

  const handleChangeText = (newMaskedValue: string) => {
    if (!newMaskedValue) {
      setActualValue("");
      setDisplayValue("");
      setValue("");
      return;
    }

    const isPaste =
      newMaskedValue.length > actualValue.length + 10 ||
      newMaskedValue.split(" ").length > actualValue.split(" ").length + 2; // safety margin, not checking specific 12 or 24 words

    if (isPaste) {
      const normalizedPaste = normalizeAndTrimRecoveryPhrase(newMaskedValue);
      setActualValue(normalizedPaste);
      setDisplayValue(maskText(normalizedPaste));
      setValue(normalizedPaste);
      return;
    }

    if (newMaskedValue.length > displayValue.length) {
      const addedChar = newMaskedValue[newMaskedValue.length - 1];
      const newValue = normalizeRecoveryPhrase(actualValue + addedChar);
      setActualValue(newValue);
      setValue(newValue);
    } else {
      const newValue = normalizeRecoveryPhrase(actualValue.slice(0, -1));
      setActualValue(newValue);
      setValue(newValue);
    }

    // Always update displayValue from actualValue
    setDisplayValue(maskText(newMaskedValue));
  };

  return (
    <Textarea
      {...restProps}
      testID={testID}
      value={showMasked ? displayValue : actualValue}
      onChangeText={handleChangeText}
      autoComplete="off"
      autoCorrect={false}
      autoCapitalize="none"
    />
  );
};

RecoveryPhraseInput.displayName = "RecoveryPhraseInput";
