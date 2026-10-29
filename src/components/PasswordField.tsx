import { FocusRing } from "components/FocusRing";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { fsValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

const EYE_ICON_SIZE = 16;
const EYE_STROKE_WIDTH = 1.5;
// Grows the 16pt eye to a 44pt touch target.
const EYE_HIT_SLOP = { top: 14, bottom: 14, left: 14, right: 14 };

const styles = StyleSheet.create({
  // Figma sets the placeholder (and a shown password) in Inter Medium 16
  // and the masked dots at 24 with -0.96 tracking. A field shows one or the
  // other, so its size follows what it shows.
  text: { fontSize: fsValue(16) },
  dots: { fontSize: fsValue(24), letterSpacing: -0.96 },
});

export interface PasswordFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Shown above the field, outside its focus ring. */
  label?: string;
  /** Help under the field; an error takes its place. */
  note?: string;
  error?: string | null;
  /**
   * Replaces the eye toggle, as the lock screen's biometrics button does.
   * Leave it out for the built-in toggle.
   */
  rightElement?: React.JSX.Element;
  /**
   * What screen readers call the eye, for a field that holds something
   * other than a password. Defaults to "Show password" and "Hide password".
   */
  visibilityLabels?: { show: string; hide: string };
  autoFocus?: boolean;
  testID?: string;
  returnKeyType?: TextInputProps["returnKeyType"];
  submitBehavior?: TextInputProps["submitBehavior"];
  onSubmitEditing?: () => void;
  /** Called when the field gains focus, after it lights its focus ring. */
  onFocus?: () => void;
}

/**
 * The app's password field, from onboarding's design: Varial's 60pt outline
 * field with its focus ring and a built-in eye that shows and hides the
 * password, slashed while masked as Figma draws it. Every screen that asks
 * for a password uses it, and Import Secret Key uses it for the secret key.
 *
 * Design: Set Password ?node-id=370-8343 (empty) and ?node-id=1-11940
 * (filled).
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(
  (
    {
      value,
      onChangeText,
      placeholder,
      label,
      note,
      error,
      rightElement,
      visibilityLabels,
      autoFocus,
      testID,
      returnKeyType,
      submitBehavior,
      onSubmitEditing,
      onFocus,
    },
    ref,
  ) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();
    const [isVisible, setIsVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const showsDots = !isVisible && value.length > 0;
    const EyeIcon = isVisible ? Icon.Eye : Icon.EyeOff;

    return (
      <View className="gap-[8px]">
        {label && (
          <Text sm secondary>
            {label}
          </Text>
        )}
        <FocusRing
          isFocused={isFocused}
          testID={testID ? `${testID}-focus-ring` : undefined}
        >
          <Input
            ref={ref}
            testID={testID}
            fieldSize="xl"
            isPassword
            secureTextEntry={!isVisible}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={themeColors.foreground.primary}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={autoFocus}
            isError={!!error}
            returnKeyType={returnKeyType}
            submitBehavior={submitBehavior}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => {
              setIsFocused(true);
              onFocus?.();
            }}
            onBlur={() => setIsFocused(false)}
            style={showsDots ? styles.dots : styles.text}
            rightElement={
              rightElement ?? (
                <TouchableOpacity
                  testID={testID ? `${testID}-visibility-button` : undefined}
                  onPress={() => setIsVisible((visible) => !visible)}
                  hitSlop={EYE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isVisible
                      ? (visibilityLabels?.hide ?? t("lockScreen.hidePassword"))
                      : (visibilityLabels?.show ?? t("lockScreen.showPassword"))
                  }
                >
                  <EyeIcon
                    size={EYE_ICON_SIZE}
                    strokeWidth={EYE_STROKE_WIDTH}
                    color={themeColors.foreground.primary}
                  />
                </TouchableOpacity>
              )
            }
          />
        </FocusRing>
        {error ? (
          <Text sm color={themeColors.status.error}>
            {error}
          </Text>
        ) : (
          note && (
            <Text sm secondary>
              {note}
            </Text>
          )
        )}
      </View>
    );
  },
);

PasswordField.displayName = "PasswordField";
