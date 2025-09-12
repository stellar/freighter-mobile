import Modal from "components/Modal";
import { Avatar } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
} from "config/constants";
import { Account } from "config/types";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

interface RenameAccountModalProps {
  modalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  handleRenameAccount: (newAccountName: string) => Promise<void>;
  account: Account;
  isRenamingAccount: boolean;
}

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
    >
      <View className="justify-center items-center">
        <Avatar size="md" publicAddress={account?.publicKey ?? ""} />
        <View className="h-4" />
        <Text primary md medium>
          {truncateAddress(account?.publicKey ?? "")}
        </Text>
        <Text secondary sm regular>
          {t("renameAccountModal.currentName")}
        </Text>
        <View className="h-8" />
      </View>
      <View>
        <Input
          placeholder={t("renameAccountModal.nameInputPlaceholder")}
          fieldSize="lg"
          leftElement={
            <Icon.UserCircle size={16} color={themeColors.foreground.primary} />
          }
          value={accountName}
          onChangeText={setAccountName}
          autoCorrect={false}
        />
      </View>
      <View className="h-4" />
      <View className="flex-row justify-between w-full mt-6 gap-3">
        <View className="flex-1">
          <Button
            secondary
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
            isFullWidth
            onPress={() => handleRenameAccount(accountName.trim())}
            isLoading={isRenamingAccount}
            disabled={!isAccountNameValid}
          >
            {t("renameAccountModal.saveName")}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default RenameAccountModal;
