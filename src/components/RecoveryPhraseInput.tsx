import { Textarea, TextareaProps } from "components/sds/Textarea";
import {
  normalizeAndTrimRecoveryPhrase,
  normalizeRecoveryPhrase,
} from "helpers/recoveryPhrase";
import React, { useState, useEffect, useRef } from "react";

export interface RecoveryPhraseInputProps
  extends Omit<TextareaProps, "value" | "onChangeText"> {
  value: string;
  showMasked?: boolean;
  setValue: (text: string) => void;
}

interface TextRange {
  start: number;
  end: number;
}

interface TextEdit extends TextRange {
  /** What replaced the range. */
  inserted: string;
}

// Shows a typed or pasted phrase as dots, as Figma draws it. One dot per
// character, so a place in the dots is the same place in the phrase.
const maskText = (text: string) => text.replace(/\S/g, "•");

/**
 * The edit that turned `previous` into `next`: the range it replaced and
 * what it put there.
 *
 * Masked, a word is a run of identical dots, so the text alone can't tell
 * which dot a Backspace removed. The selection when the key was pressed can,
 * so an edit that fits it is placed there. Otherwise, as for a paste, the
 * longest common start and end bound the change.
 */
const findEdit = (
  previous: string,
  next: string,
  selection: TextRange | null,
): TextEdit => {
  if (selection) {
    const lengthChange = next.length - previous.length;
    const { start, end } = selection;
    const ranges: TextRange[] =
      start === end && lengthChange < 0
        ? [
            // Backspace removes what's before the caret; Delete, what's after.
            { start: start + lengthChange, end: start },
            { start, end: start - lengthChange },
          ]
        : [selection];
    const fitting = ranges
      .filter((range) => range.start >= 0 && range.end <= previous.length)
      .map((range) => ({
        ...range,
        inserted: next.slice(
          range.start,
          range.start + lengthChange + range.end - range.start,
        ),
      }))
      .find(
        (edit) =>
          previous.slice(0, edit.start) +
            edit.inserted +
            previous.slice(edit.end) ===
          next,
      );

    if (fitting) return fitting;
  }

  const shorter = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < shorter && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    start: prefix,
    end: previous.length - suffix,
    inserted: next.slice(prefix, next.length - suffix),
  };
};

export const RecoveryPhraseInput: React.FC<RecoveryPhraseInputProps> = ({
  value,
  showMasked = true,
  onFocus,
  onBlur,
  onSelectionChange,
  onKeyPress,
  setValue,
  testID,
  ...restProps
}) => {
  const [actualValue, setActualValue] = useState(value);
  // Where the caret or selection is, and where it was when the last key was
  // pressed: the edit that key makes starts there. React Native reports the
  // key before the text it changes, on iOS and Android.
  const selectionRef = useRef<TextRange | null>(null);
  const editSelectionRef = useRef<TextRange | null>(null);

  // Update internal state when value prop changes
  useEffect(() => {
    setActualValue(value);
  }, [value]);

  const shownText = showMasked ? maskText(actualValue) : actualValue;

  // Applies each change where it happened, so editing one word leaves the
  // others as they are.
  const handleChangeText = (nextShownText: string) => {
    const edit = findEdit(shownText, nextShownText, editSelectionRef.current);
    editSelectionRef.current = null;

    const edited =
      actualValue.slice(0, edit.start) +
      edit.inserted +
      actualValue.slice(edit.end);
    // Into an empty field, a pasted phrase loses its outer spaces. After
    // that, a space typed after a word is kept for the next one.
    const newValue = actualValue
      ? normalizeRecoveryPhrase(edited)
      : normalizeAndTrimRecoveryPhrase(edited);

    setActualValue(newValue);
    setValue(newValue);
  };

  return (
    <Textarea
      {...restProps}
      testID={testID}
      value={shownText}
      onChangeText={handleChangeText}
      onSelectionChange={(event) => {
        selectionRef.current = event.nativeEvent.selection;
        onSelectionChange?.(event);
      }}
      onKeyPress={(event) => {
        editSelectionRef.current = selectionRef.current;
        onKeyPress?.(event);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      autoComplete="off"
      autoCorrect={false}
      autoCapitalize="none"
    />
  );
};

RecoveryPhraseInput.displayName = "RecoveryPhraseInput";
