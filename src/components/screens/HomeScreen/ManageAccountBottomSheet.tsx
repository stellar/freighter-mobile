import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AccountItemRow from "components/screens/HomeScreen/AccoutItemRow";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { Account } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ManageAccountBottomSheetProps {
  handleCloseModal: () => void;
  onPressAddAnotherWallet: () => void;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: (account: Account) => void;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
}

const ManageAccountBottomSheet: React.FC<ManageAccountBottomSheetProps> = ({
  handleCloseModal,
  onPressAddAnotherWallet,
  handleCopyAddress,
  handleRenameAccount,
  accounts,
  activeAccount,
  handleSelectAccount,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="flex-1 justify-between items-center">
      <View className="flex-row items-center justify-between w-full">
        <TouchableOpacity onPress={handleCloseModal}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
        <Text md primary semiBold>
          {t("home.manageAccount.title")}
        </Text>
        <TouchableOpacity onPress={onPressAddAnotherWallet}>
          <Icon.PlusCircle size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      </View>
      <BottomSheetScrollView
        className="w-full"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        contentContainerStyle={{
          paddingTop: pxValue(24),
        }}
      >
        {accounts.map((account) => (
          <AccountItemRow
            key={account.publicKey}
            account={account}
            handleCopyAddress={handleCopyAddress}
            handleRenameAccount={handleRenameAccount}
            handleSelectAccount={handleSelectAccount}
            isSelected={account.publicKey === activeAccount?.publicKey}
          />
        ))}
      </BottomSheetScrollView>
      <Button tertiary isFullWidth lg onPress={onPressAddAnotherWallet}>
        {t("home.manageAccount.addWallet")}
      </Button>
    </View>
  );
};

export default ManageAccountBottomSheet;
