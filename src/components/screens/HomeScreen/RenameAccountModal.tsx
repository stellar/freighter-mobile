import Modal from "components/Modal";
import RenameAccountForm from "components/screens/HomeScreen/RenameAccountForm";
import { DEFAULT_PADDING } from "config/constants";
import { Account } from "config/types";
import { pxValue } from "helpers/dimensions";
import React from "react";

interface RenameAccountModalProps {
  modalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  handleRenameAccount: (newAccountName: string) => Promise<void>;
  /** Account being renamed; null until a rename is requested. */
  account: Account | null;
  isRenamingAccount: boolean;
}

/**
 * Modal for renaming a wallet. Uses the shared Modal's `position="keyboard"`
 * mode so the card slides with the keyboard instead of jumping.
 */
const RenameAccountModal: React.FC<RenameAccountModalProps> = ({
  modalVisible,
  setModalVisible,
  handleRenameAccount,
  account,
  isRenamingAccount,
}) => (
  <Modal
    visible={modalVisible}
    onClose={() => setModalVisible(false)}
    closeOnOverlayPress={false}
    position="keyboard"
    contentClassName="bg-background-primary rounded-[32px] w-full"
    contentStyle={{ padding: pxValue(DEFAULT_PADDING) }}
  >
    <RenameAccountForm
      account={account}
      isRenamingAccount={isRenamingAccount}
      onCancel={() => setModalVisible(false)}
      onSave={handleRenameAccount}
    />
  </Modal>
);

export default RenameAccountModal;
