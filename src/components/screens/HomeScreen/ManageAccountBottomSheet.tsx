import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import BottomSheetAdaptiveContainer from "components/primitives/BottomSheetAdaptiveContainer";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
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
import { heightPercentageToDP } from "react-native-responsive-screen";

interface ManageAccountBottomSheetProps {
  handleCloseModal: () => void;
  onPressAddAnotherWallet: () => void;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: (account: Account) => void;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
}

const SNAP_VALUE_PERCENT = 80;

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
    <View className="flex-1 justify-between items-center w-full">
      <BottomSheetAdaptiveContainer
        bottomPaddingPx={heightPercentageToDP(100 - SNAP_VALUE_PERCENT)}
        header={
          <View className="flex-row items-center justify-between w-full">
            <TouchableOpacity onPress={handleCloseModal}>
              <Icon.X color={themeColors.base[1]} />
            </TouchableOpacity>
            <Text md primary semiBold>
              {t("home.manageAccount.title")}
            </Text>
            {/* Add a ghost icon here so the title remains centered */}
            <View className="opacity-0">
              <Icon.X />
            </View>
          </View>
        }
      >
        <BottomSheetScrollView
          className="w-full"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          contentContainerStyle={{
            paddingTop: pxValue(10),
            paddingBottom: pxValue(20),
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
      </BottomSheetAdaptiveContainer>
    </View>
  );
};

export default ManageAccountBottomSheet;
