import { FocusRing } from "components/FocusRing";
import { RecoveryPhraseInput } from "components/RecoveryPhraseInput";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { normalizeAndTrimRecoveryPhrase } from "helpers/recoveryPhrase";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import React, { useEffect, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

// Figma (?node-id=2091-40745) places the button 8pt inside the field's 1pt
// border, at the bottom-right corner, 36pt tall.
const ACTION_OFFSET = 9;
const ACTION_SIZE = 36;
const EYE_ICON_SIZE = 16;
const EYE_STROKE_WIDTH = 2;

interface RecoveryPhraseFieldProps {
  value: string;
  onChangeText: (phrase: string) => void;
  placeholder: string;
  error?: string | null;
  /** The field's text input, for a screen that focuses it itself. */
  ref?: React.Ref<TextInput>;
  testID?: string;
}

/**
 * The recovery phrase input from Figma: a 160pt outline field with
 * Varial's focus ring and one button in its bottom-right corner. While the
 * field is empty, the button pastes the clipboard, normalized like typed
 * text; once there's a phrase, it shows and hides it instead. The phrase
 * starts masked, and masks again whenever the field is emptied. An error
 * shows under the field.
 *
 * The field has no edit menu. Its Copy would put a shown phrase on the
 * clipboard as plain text, outside the secure clipboard, and its Paste would
 * leave the phrase there for any app to read. Paste is the field's own
 * button, which clears the clipboard once the phrase is in.
 *
 * Design: empty ?node-id=2091-40745, masked ?node-id=2091-40994, shown
 * ?node-id=3514-104321. ImportRecoveryPhraseTemplate shares it with the
 * future Add Account flow (?node-id=2554-161020).
 */
export const RecoveryPhraseField: React.FC<RecoveryPhraseFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  error,
  ref,
  testID,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText, clearClipboard } = useSecureClipboard();
  const [isMasked, setIsMasked] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const isEmpty = value.length === 0;

  // A new phrase starts hidden, whoever cleared the last one.
  useEffect(() => {
    if (isEmpty) setIsMasked(true);
  }, [isEmpty]);

  // Reads the phrase through the secure clipboard and, once it's in the
  // field, clears it from the system clipboard, where any app could read it.
  const handlePaste = () => {
    getClipboardText()
      .then((clipboardText) => {
        const phrase = normalizeAndTrimRecoveryPhrase(clipboardText);
        if (!phrase) return undefined;

        onChangeText(phrase);
        return clearClipboard();
      })
      .catch((readError: unknown) => {
        logger.warn(
          "RecoveryPhraseField.handlePaste",
          "Couldn't paste the recovery phrase",
          readError,
        );
      });
  };

  const actionSurface = {
    backgroundColor: themeColors.background.primary,
    borderColor: themeColors.border.primary,
  };
  const EyeIcon = isMasked ? Icon.EyeOff : Icon.Eye;

  return (
    <View className="gap-[8px]">
      <FocusRing
        isFocused={isFocused}
        testID={testID ? `${testID}-focus-ring` : undefined}
      >
        <RecoveryPhraseInput
          testID={testID}
          fieldSize="xl"
          placeholder={placeholder}
          placeholderTextColor={themeColors.foreground.primary}
          value={value}
          setValue={onChangeText}
          contextMenuHidden
          showMasked={isMasked}
          isError={!!error}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <View
          className="absolute"
          style={{ right: ACTION_OFFSET, bottom: ACTION_OFFSET }}
        >
          {isEmpty ? (
            <TouchableOpacity
              // The e2e flows paste the phrase through this ID.
              testID="clipboard-button"
              onPress={handlePaste}
              accessibilityRole="button"
              className="items-center justify-center rounded-full border px-[12px]"
              style={[{ height: ACTION_SIZE }, actionSurface]}
            >
              <Text sm semiBold primary>
                {t("common.paste")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID={testID ? `${testID}-visibility-button` : undefined}
              onPress={() => setIsMasked((masked) => !masked)}
              accessibilityRole="button"
              accessibilityLabel={
                isMasked
                  ? t("recoveryPhraseField.showPhrase")
                  : t("recoveryPhraseField.hidePhrase")
              }
              className="items-center justify-center rounded-full border"
              style={[
                { width: ACTION_SIZE, height: ACTION_SIZE },
                actionSurface,
              ]}
            >
              <EyeIcon
                size={EYE_ICON_SIZE}
                strokeWidth={EYE_STROKE_WIDTH}
                color={themeColors.foreground.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </FocusRing>
      {error ? (
        <Text sm color={themeColors.status.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};
