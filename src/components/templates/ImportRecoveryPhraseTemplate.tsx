import { RecoveryPhraseField } from "components/RecoveryPhraseField";
import { OnboardLayout } from "components/layout/OnboardLayout";
import React from "react";
import { TextInput, View } from "react-native";

export interface ImportRecoveryPhraseTemplateProps {
  title: string;
  description: string;
  placeholder: string;
  submitButtonText: string;
  phrase: string;
  onChangePhrase: (phrase: string) => void;
  onSubmit: () => void;
  error?: string | null;
  isSubmitting?: boolean;
  /** The field's text input, for the screen to focus once it has slid in. */
  inputRef?: React.Ref<TextInput>;
  testID?: string;
}

/**
 * Asks for a recovery phrase: a title, one description, the recovery phrase
 * field and a submit button, disabled while the field is empty.
 *
 * Import Wallet uses it (?node-id=2091-40745), and so will the Add Account
 * flow (?node-id=2554-161020) with its own copy, so the screens own the
 * phrase and what submitting does.
 */
export const ImportRecoveryPhraseTemplate: React.FC<
  ImportRecoveryPhraseTemplateProps
> = ({
  title,
  description,
  placeholder,
  submitButtonText,
  phrase,
  onChangePhrase,
  onSubmit,
  error,
  isSubmitting,
  inputRef,
  testID,
}) => (
  <OnboardLayout
    title={title}
    description={description}
    defaultActionButtonText={submitButtonText}
    isDefaultActionButtonDisabled={!phrase}
    onPressDefaultActionButton={onSubmit}
    isLoading={isSubmitting}
  >
    {/* 20pt under the field and its error, so with the keyboard up on a
        small screen the button never touches them. */}
    <View testID={testID ? `${testID}-field` : undefined} className="pb-[20px]">
      <RecoveryPhraseField
        testID={testID}
        value={phrase}
        onChangeText={onChangePhrase}
        placeholder={placeholder}
        error={error}
        ref={inputRef}
      />
    </View>
  </OnboardLayout>
);
