import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
} from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

export interface AccountNameFormProps {
  title: string;
  /** The name the field starts with; it resets when this changes. */
  initialName: string;
  /** The account's address, for its avatar. Absent before it exists. */
  publicKey?: string;
  submitLabel: string;
  /** Shows Cancel beside the submit button, as rename does. */
  showCancel?: boolean;
  isSubmitting?: boolean;
  onSubmit: (accountName: string) => void | Promise<void>;
  onClose: () => void;
  /** Set inside a bottom sheet so the field works with its keyboard handling. */
  isBottomSheetInput?: boolean;
  testID?: string;
}

/**
 * The account name sheet body: avatar, a single autofocused name input and
 * the actions. Rename uses it with Cancel / Save name; Create new wallet uses
 * it with the next default name and a single Create or Next.
 */
const AccountNameForm: React.FC<AccountNameFormProps> = ({
  title,
  initialName,
  publicKey,
  submitLabel,
  showCancel = false,
  isSubmitting = false,
  onSubmit,
  onClose,
  isBottomSheetInput = false,
  testID = "account-name-form",
}) => {
  const { t } = useAppTranslation();
  const [accountName, setAccountName] = useState(initialName);

  useEffect(() => {
    setAccountName(initialName);
  }, [initialName]);

  // Trimmed before measuring so a whitespace-only name counts as empty.
  const isAccountNameValid = useMemo(
    () =>
      accountName.trim().length >= ACCOUNT_NAME_MIN_LENGTH &&
      accountName.trim().length <= ACCOUNT_NAME_MAX_LENGTH,
    [accountName],
  );

  const submitButton = (
    <Button
      secondary
      xl
      isFullWidth
      onPress={() => onSubmit(accountName.trim())}
      isLoading={isSubmitting}
      disabled={!isAccountNameValid}
      testID={`${testID}-submit`}
    >
      {submitLabel}
    </Button>
  );

  return (
    <View className="gap-6" testID={testID}>
      <View className="items-center gap-4">
        <View className="w-full">
          <BottomSheetHeader
            layout="centered"
            title={title}
            onClose={onClose}
            // Closing mid-save would drop the result, so the X is disabled
            // until the save settles, like the Cancel button.
            closeDisabled={isSubmitting}
            closeTestID={`${testID}-close`}
          />
        </View>
        <Avatar size="xxl" publicAddress={publicKey ?? ""} />
      </View>
      <Input
        placeholder={t("renameAccountModal.nameInputPlaceholder")}
        fieldSize="lg"
        value={accountName}
        onChangeText={setAccountName}
        autoCorrect={false}
        autoFocus
        isBottomSheetInput={isBottomSheetInput}
        testID={`${testID}-input`}
      />
      {showCancel ? (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              tertiary
              xl
              isFullWidth
              onPress={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
          </View>
          <View className="flex-1">{submitButton}</View>
        </View>
      ) : (
        submitButton
      )}
    </View>
  );
};

export default AccountNameForm;
