import { Textarea, TextareaProps } from "components/sds/Textarea";
import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";
import { NativeSyntheticEvent, TextInputFocusEventData } from "react-native";

export interface RecoveryPhraseInputProps
  extends Omit<TextareaProps, "value" | "onChangeText"> {
  value: string;
  onChangeText: (text: string) => void;
  showMasked?: boolean;
}

const FINISH_TYPING_DELAY_MS = 1500;

/**
 * Normalizes text by converting to lowercase and removing accents
 */
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/\s+/g, " ")
    .trim(); // Normalize spaces and trim

/**
 * Masks a recovery phrase by replacing each word with asterisks
 * while preserving spaces between words
 */
const maskRecoveryPhrase = (phrase: string): string => {
  if (!phrase.trim()) return phrase;

  return phrase
    .split(" ")
    .map((word) => (word ? "*".repeat(word.length) : ""))
    .join(" ");
};

/**
 * Masks completed words but shows the current word being typed
 */
const maskCompletedWords = (phrase: string): string => {
  if (!phrase.trim()) return phrase;

  const words = phrase.split(" ");
  const lastWordIndex = words.length - 1;

  return words
    .map((word, index) => {
      if (!word) return "";
      // Show the last word (current word being typed), mask all others
      if (index === lastWordIndex) {
        return word;
      }
      return "*".repeat(word.length);
    })
    .join(" ");
};

export const RecoveryPhraseInput: React.FC<RecoveryPhraseInputProps> = ({
  value,
  onChangeText,
  showMasked = true,
  onFocus,
  onBlur,
  ...restProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const [lastPastedValue, setLastPastedValue] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedValue = useMemo(() => {
    const normalized = normalizeText(internalValue);
    setInternalValue(normalized);
    return normalized;
  }, [internalValue]);

  const displayValue = useMemo(() => {
    if (!showMasked) {
      return normalizedValue;
    }

    // Always mask if it's a pasted value (detected by significant length increase)
    if (
      lastPastedValue &&
      normalizedValue.length > lastPastedValue.length + 10
    ) {
      return maskRecoveryPhrase(normalizedValue);
    }

    // If typing and focused, mask completed words but show current word
    if (isTyping && isFocused) {
      return maskCompletedWords(normalizedValue);
    }

    // Otherwise, mask the text
    return maskRecoveryPhrase(normalizedValue);
  }, [normalizedValue, showMasked, isFocused, isTyping, lastPastedValue]);

  const handleTextChange = useCallback(
    (text: string) => {
      const normalized = normalizeText(text);
      setInternalValue(normalized);
      onChangeText(normalized);

      // Detect if this looks like a paste (significant length increase or multiple words)
      const wordCount = normalized.trim().split(/\s+/).length;
      const previousWordCount = internalValue.trim().split(/\s+/).length;

      if (
        normalized.length > internalValue.length + 10 ||
        wordCount > previousWordCount + 2 // safety margin, not checking specific 12 or 24 words
      ) {
        setLastPastedValue(internalValue);
        setIsTyping(false);
      } else {
        setIsTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, FINISH_TYPING_DELAY_MS);
      }
    },
    [onChangeText, internalValue],
  );

  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocused(true);
      if (onFocus) {
        onFocus(e);
      }
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocused(false);
      setIsTyping(false);
      if (onBlur) {
        onBlur(e);
      }
    },
    [onBlur],
  );

  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value, internalValue]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <Textarea
      {...restProps}
      value={displayValue}
      onChangeText={handleTextChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      autoComplete="off"
      autoCorrect={false}
      autoCapitalize="none"
    />
  );
};

RecoveryPhraseInput.displayName = "RecoveryPhraseInput";
