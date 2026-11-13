import AccountNameForm from "components/AccountNameForm";
import { Account } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

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
 * The rename form: the account name form with Cancel / Save name. Edit
 * account shows it in a bottom sheet.
 */
const RenameAccountForm: React.FC<RenameAccountFormProps> = ({
  account,
  isRenamingAccount,
  onCancel,
  onSave,
  isBottomSheetInput = false,
}) => {
  const { t } = useAppTranslation();

  return (
    <AccountNameForm
      title={t("renameAccountModal.title")}
      initialName={account?.name ?? ""}
      publicKey={account?.publicKey}
      submitLabel={t("renameAccountModal.saveName")}
      showCancel
      isSubmitting={isRenamingAccount}
      onSubmit={onSave}
      onClose={onCancel}
      isBottomSheetInput={isBottomSheetInput}
      testID="rename-account"
    />
  );
};

export default RenameAccountForm;
