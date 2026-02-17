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
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { heightPercentageToDP } from "react-native-responsive-screen";

interface ManageAccountBottomSheetProps {
  handleCloseModal: () => void;
  onPressAddAnotherWallet: () => void;
  handleCopyAddress: (publicKey: string) => void;
  handleRenameAccount: (account: Account) => void;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  handleSelectAccount: (publicKey: string) => Promise<void>;
  isAccountSwitching: boolean;
}

const SNAP_VALUE_PERCENT = 80;

export const ManageAccountBottomSheet: React.FC<
  ManageAccountBottomSheetProps
> = ({
  handleCloseModal,
  onPressAddAnotherWallet,
  handleCopyAddress,
  handleRenameAccount,
  accounts,
  activeAccount,
  handleSelectAccount,
  isAccountSwitching,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  // Styles moved to className props below; no StyleSheet used
  return (
    <View className="flex-1 justify-between items-center w-full relative">
      <BottomSheetAdaptiveContainer
        bottomPaddingPx={heightPercentageToDP(100 - SNAP_VALUE_PERCENT)}
        header={
          <View className="flex-row items-center justify-center relative w-full">
            <TouchableOpacity
              onPress={handleCloseModal}
              className="absolute left-0"
              testID="manage-accounts-close-button"
            >
              <Icon.X color={themeColors.base[1]} />
            </TouchableOpacity>
            <Text md primary semiBold>
              {t("home.manageAccount.title")}
            </Text>
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
          {accounts.map((account, index) => (
            <AccountItemRow
              key={account.publicKey}
              account={account}
              handleCopyAddress={handleCopyAddress}
              handleRenameAccount={handleRenameAccount}
              handleSelectAccount={handleSelectAccount}
              isSelected={account.publicKey === activeAccount?.publicKey}
              isAccountSwitching={isAccountSwitching}
              testID={`account-row-${index}`}
            />
          ))}
        </BottomSheetScrollView>
        <Button
          tertiary
          isFullWidth
          xl
          onPress={onPressAddAnotherWallet}
          disabled={isAccountSwitching}
          testID="manage-accounts-add-wallet-button"
        >
          {t("home.manageAccount.addWallet")}
        </Button>
      </BottomSheetAdaptiveContainer>
      {isAccountSwitching && (
        <View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: themeColors.overlay[4],
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
          testID="account-switching-overlay"
        >
          <ActivityIndicator
            size="large"
            color={themeColors.foreground.primary}
          />
        </View>
      )}
    </View>
  );
};

export default ManageAccountBottomSheet;
