import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import BottomSheet from "components/BottomSheet";
import ManageAccountBottomSheet from "components/screens/HomeScreen/ManageAccountBottomSheet";
import RenameAccountModal from "components/screens/HomeScreen/RenameAccountModal";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  MainTabStackParamList,
  RootStackParamList,
  MAIN_TAB_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { Account } from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import React, { useCallback, useState } from "react";
import { analytics } from "services/analytics";

interface ManageAccountsProps {
  navigation: BottomTabNavigationProp<
    MainTabStackParamList & RootStackParamList,
    typeof MAIN_TAB_ROUTES.TAB_HOME
  >;
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
}

const ManageAccounts: React.FC<ManageAccountsProps> = ({
  navigation,
  accounts,
  activeAccount,
  bottomSheetRef,
}) => {
  const { renameAccount, selectAccount, isRenamingAccount } =
    useAuthenticationStore();
  const { copyToClipboard } = useClipboard();
  const { t } = useAppTranslation();

  const [accountToRename, setAccountToRename] = useState<Account | null>(null);
  const [renameAccountModalVisible, setRenameAccountModalVisible] =
    useState(false);

  const handleCopyAddress = useCallback(
    (publicKey?: string) => {
      if (!publicKey) return;

      copyToClipboard(publicKey, {
        notificationMessage: t("accountAddressCopied"),
      });

      analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_COPY_PUBLIC_KEY);
    },
    [copyToClipboard, t],
  );

  const handleAddAnotherWallet = useCallback(() => {
    analytics.track(AnalyticsEvent.ACCOUNT_SCREEN_ADD_ACCOUNT);

    bottomSheetRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK);
  }, [navigation, bottomSheetRef]);

  const handleRenameAccount = useCallback(
    async (newAccountName: string) => {
      if (!accountToRename || !activeAccount) return;

      analytics.trackViewPublicKeyAccountRenamed(
        accountToRename.name,
        newAccountName,
      );

      await renameAccount({
        accountName: newAccountName,
        publicKey: accountToRename.publicKey,
      });
      setRenameAccountModalVisible(false);
    },
    [accountToRename, activeAccount, renameAccount],
  );

  const handleSelectAccount = useCallback(
    async (publicKey: string) => {
      if (publicKey === activeAccount?.publicKey) {
        return;
      }

      await selectAccount(publicKey);
      bottomSheetRef.current?.dismiss();
    },
    [activeAccount, selectAccount, bottomSheetRef],
  );

  const handleOpenRenameAccountModal = useCallback(
    (selectedAccount: Account) => {
      setAccountToRename(selectedAccount);
      setRenameAccountModalVisible(true);
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

  return (
    <>
      <BottomSheet
        snapPoints={["80%"]}
        modalRef={bottomSheetRef}
        handleCloseModal={handleCloseModal}
        enablePanDownToClose={false}
        analyticsEvent={AnalyticsEvent.VIEW_MANAGE_WALLETS}
        customContent={
          <ManageAccountBottomSheet
            handleCloseModal={handleCloseModal}
            onPressAddAnotherWallet={handleAddAnotherWallet}
            handleCopyAddress={handleCopyAddress}
            handleRenameAccount={handleOpenRenameAccountModal}
            accounts={accounts}
            activeAccount={activeAccount}
            handleSelectAccount={handleSelectAccount}
          />
        }
      />
      <RenameAccountModal
        modalVisible={renameAccountModalVisible}
        setModalVisible={setRenameAccountModalVisible}
        handleRenameAccount={handleRenameAccount}
        account={accountToRename!}
        isRenamingAccount={isRenamingAccount}
      />
    </>
  );
};

export default ManageAccounts;
