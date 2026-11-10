import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
} from "config/constants";
import { Account } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

export interface RenameAccountFormProps {
  /** Account being renamed; null until a rename is requested. */
  account: Account | null;
  isRenamingAccount: boolean;
  onCancel: () => void;
  onSave: (newAccountName: string) => Promise<void>;
  /** Set inside a bottom sheet so the field works with its keyboard handling. */
  isBottomSheetInput?: boolean;
}

/**
 * The rename form: avatar, a single autofocused name input and Cancel / Save
 * name actions. Edit account shows it in a bottom sheet.
 */
const RenameAccountForm: React.FC<RenameAccountFormProps> = ({
  account,
  isRenamingAccount,
  onCancel,
  onSave,
  isBottomSheetInput = false,
}) => {
  const { t } = useAppTranslation();
  const [accountName, setAccountName] = useState(account?.name ?? "");

  useEffect(() => {
    setAccountName(account?.name ?? "");
  }, [account]);

  const isAccountNameValid = useMemo(
    () =>
      accountName.trim().length >= ACCOUNT_NAME_MIN_LENGTH &&
      accountName.trim().length <= ACCOUNT_NAME_MAX_LENGTH,
    [accountName],
  );

  return (
    <View className="gap-6">
      <View className="items-center gap-4">
        <View className="w-full">
          <BottomSheetHeader
            layout="centered"
            title={t("renameAccountModal.title")}
            onClose={onCancel}
            // Closing mid-rename would drop the result, so the X is
            // disabled until the save settles, like the Cancel button.
            closeDisabled={isRenamingAccount}
            closeTestID="rename-account-close-button"
          />
        </View>
        <Avatar size="xxl" publicAddress={account?.publicKey ?? ""} />
      </View>
      <Input
        placeholder={t("renameAccountModal.nameInputPlaceholder")}
        fieldSize="lg"
        value={accountName}
        onChangeText={setAccountName}
        autoCorrect={false}
        autoFocus
        isBottomSheetInput={isBottomSheetInput}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            tertiary
            xl
            isFullWidth
            onPress={onCancel}
            disabled={isRenamingAccount}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            secondary
            xl
            isFullWidth
            onPress={() => onSave(accountName.trim())}
            isLoading={isRenamingAccount}
            disabled={!isAccountNameValid}
          >
            {t("renameAccountModal.saveName")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default RenameAccountForm;
