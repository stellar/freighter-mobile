import Modal from "components/Modal";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
  DEFAULT_PADDING,
} from "config/constants";
import { Account } from "config/types";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface RenameAccountModalProps {
  modalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  handleRenameAccount: (newAccountName: string) => Promise<void>;
  /** Account being renamed; null until a rename is requested. */
  account: Account | null;
  isRenamingAccount: boolean;
}

/**
 * Modal for renaming a wallet: avatar, a single autofocused name input and
 * Cancel / Save name actions. Uses the shared Modal's `position="keyboard"`
 * mode so the card slides with the keyboard instead of jumping.
 */
const RenameAccountModal: React.FC<RenameAccountModalProps> = ({
  modalVisible,
  setModalVisible,
  handleRenameAccount,
  account,
  isRenamingAccount,
}) => {
  const { themeColors } = useColors();
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
    <Modal
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
      closeOnOverlayPress={false}
      position="keyboard"
      contentClassName="bg-background-primary rounded-[32px] w-full"
      contentStyle={{ padding: pxValue(DEFAULT_PADDING) }}
    >
      <View className="gap-6">
        <View className="items-center">
          <View className="w-full items-end">
            <TouchableOpacity
              className="w-[40px] h-[40px] rounded-full bg-background-tertiary justify-center items-center"
              onPress={() => setModalVisible(false)}
              disabled={isRenamingAccount}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              testID="rename-account-close-button"
            >
              <Icon.X size={24} color={themeColors.foreground.primary} />
            </TouchableOpacity>
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
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={() => setModalVisible(false)}
              disabled={isRenamingAccount}
            >
              {t("common.cancel")}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              tertiary
              xl
              isFullWidth
              onPress={() => handleRenameAccount(accountName.trim())}
              isLoading={isRenamingAccount}
              disabled={!isAccountNameValid}
            >
              {t("renameAccountModal.saveName")}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RenameAccountModal;
