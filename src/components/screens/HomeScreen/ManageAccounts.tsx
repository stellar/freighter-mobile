import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import BottomSheet from "components/BottomSheet";
import AddWalletFooter from "components/screens/HomeScreen/AddWalletFooter";
import ManageAccountBottomSheet, {
  ManageAccountSheetHeader,
} from "components/screens/HomeScreen/ManageAccountBottomSheet";
import RenameAccountModal from "components/screens/HomeScreen/RenameAccountModal";
import { AnalyticsEvent } from "config/analyticsConfig";
import { ERROR_TOAST_DURATION } from "config/constants";
import { logger } from "config/logger";
import { RootStackParamList, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { Account } from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import { analytics } from "services/analytics";

interface ManageAccountsProps {
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  showAddWallet?: boolean;
  isLoadingAccounts?: boolean;
}

const MAX_SHEET_HEIGHT_RATIO = 0.83;
const ACCOUNT_SWITCH_DISMISS_DELAY_MS = 500;

const ManageAccounts: React.FC<ManageAccountsProps> = ({
  accounts,
  activeAccount,
  bottomSheetRef,
  showAddWallet = true,
  isLoadingAccounts = false,
}) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {
    network,
    renameAccount,
    selectAccount,
    isRenamingAccount,
    isSwitchingAccount,
  } = useAuthenticationStore();
  const fiatTotals = useAccountsFiatTotalsStore((state) => state.fiatTotals);
  const isLoadingFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.isLoading,
  );
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );
  const { copyToClipboard } = useClipboard();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const [accountToRename, setAccountToRename] = useState<Account | null>(null);
  const [renameAccountModalVisible, setRenameAccountModalVisible] =
    useState(false);
  const [switchingToPublicKey, setSwitchingToPublicKey] = useState<
    string | null
  >(null);

  const handleSheetPresent = useCallback(
    (index: number) => {
      if (index < 0) {
        return;
      }

      if (accounts.length === 0 && activeAccount && !isLoadingAccounts) {
        showToast({
          toastId: "manage-accounts-load-error",
          variant: "error",
          title: t("authStore.error.getAccountsFailedTitle"),
          message: t("authStore.error.getAccountsFailedMessage"),
          duration: ERROR_TOAST_DURATION,
        });
      }

      if (accounts.length > 0) {
        fetchAccountsFiatTotals({
          publicKeys: accounts.map((account) => account.publicKey),
          network,
        });
      }
    },
    [
      accounts,
      activeAccount,
      isLoadingAccounts,
      showToast,
      t,
      fetchAccountsFiatTotals,
      network,
    ],
  );

  const handleOpenSettings = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK);
  }, [navigation, bottomSheetRef]);

  const handleOpenMyQRCode = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN, {
      initialTab: "receive",
    });
  }, [navigation, bottomSheetRef]);

  const handleCopyActiveAddress = useCallback(() => {
    if (!activeAccount) {
      return;
    }

    copyToClipboard(activeAccount.publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });

    analytics.trackCopyPublicKey();
  }, [activeAccount, copyToClipboard, t]);

  const handleViewActiveOnExplorer = useCallback(() => {
    if (!activeAccount) {
      return;
    }

    const url = `${getStellarExpertUrl(network)}/account/${activeAccount.publicKey}`;
    analytics.track(AnalyticsEvent.VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT);

    openInAppBrowser(url).catch((error) =>
      logger.warn(
        "ManageAccounts",
        "Error opening account on stellar.expert:",
        error,
      ),
    );
  }, [activeAccount, network, openInAppBrowser]);

  const handleOpenRenameActiveAccount = useCallback(() => {
    if (!activeAccount) {
      return;
    }

    // Prefer the entry from the accounts list (it carries flags like
    // importedFromSecretKey); fall back to mapping the active account.
    const account = accounts.find(
      (item) => item.publicKey === activeAccount.publicKey,
    ) ?? {
      id: activeAccount.id,
      name: activeAccount.accountName,
      publicKey: activeAccount.publicKey,
    };

    setAccountToRename(account);
    setRenameAccountModalVisible(true);
  }, [accounts, activeAccount]);

  const handleAddAnotherWallet = useCallback(() => {
    if (!navigation) return;

    // account.created (ACCOUNT_SCREEN_ADD_ACCOUNT) fires on the actual
    // creation-success path (ducks/auth createAccount), not here at tap time —
    // so it isn't counted when the add flow is abandoned.
    bottomSheetRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK);
  }, [navigation, bottomSheetRef]);

  const handleRenameAccount = useCallback(
    async (newAccountName: string) => {
      if (!accountToRename || !activeAccount) return;

      analytics.trackViewPublicKeyAccountRenamed();

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
      // switchingToPublicKey covers the post-switch window where the auth
      // store has already cleared its flag but the sheet is still showing
      // the loaded state before dismissing.
      if (
        publicKey === activeAccount?.publicKey ||
        isSwitchingAccount ||
        switchingToPublicKey !== null
      ) {
        return;
      }

      setSwitchingToPublicKey(publicKey);

      // Keep sheet open and start account switch immediately
      try {
        await selectAccount(publicKey);
        // Wait for data to load and show the loaded state briefly
        await new Promise((resolve) => {
          setTimeout(resolve, ACCOUNT_SWITCH_DISMISS_DELAY_MS);
        });
        bottomSheetRef.current?.dismiss();
      } finally {
        setSwitchingToPublicKey(null);
      }
    },
    [
      activeAccount,
      isSwitchingAccount,
      switchingToPublicKey,
      selectAccount,
      bottomSheetRef,
    ],
  );

  const handleCloseModal = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

  const { height: windowHeight } = useWindowDimensions();
  const isSwitchInProgress =
    isSwitchingAccount || switchingToPublicKey !== null;

  const renderSheetHeader = useCallback(
    () => (
      <ManageAccountSheetHeader
        onPressSettings={handleOpenSettings}
        onPressClose={handleCloseModal}
      />
    ),
    [handleOpenSettings, handleCloseModal],
  );

  const renderAddWalletFooter = useCallback(
    () => (
      <AddWalletFooter
        onPress={handleAddAnotherWallet}
        disabled={isSwitchInProgress}
      />
    ),
    [handleAddAnotherWallet, isSwitchInProgress],
  );

  return (
    <>
      {/* Scrollable mode (same recipe as the history details sheet): the
          pinned header/footer live inside the sheet's content tree, so the
          whole sheet slides in as one unit, and dynamic sizing measures the
          content before animating. The footer owns the safe-area padding;
          without a footer the wrapper's inset padding takes over. */}
      <BottomSheet
        modalRef={bottomSheetRef}
        handleCloseModal={handleCloseModal}
        scrollable
        useInsetsBottomPadding={!showAddWallet}
        maxDynamicContentSize={windowHeight * MAX_SHEET_HEIGHT_RATIO}
        analyticsEvent={AnalyticsEvent.VIEW_MANAGE_WALLETS}
        bottomSheetModalProps={{ onChange: handleSheetPresent }}
        scrollViewHeaderComponent={renderSheetHeader}
        scrollViewFooterComponent={
          showAddWallet ? renderAddWalletFooter : undefined
        }
        // The only keyboard over this sheet belongs to the rename modal on
        // top — keep the add-wallet footer stuck to the bottom.
        scrollViewFooterAvoidsKeyboard={false}
        customContent={
          <ManageAccountBottomSheet
            onPressMyQRCode={handleOpenMyQRCode}
            onPressCopyAddress={handleCopyActiveAddress}
            onPressViewOnExplorer={handleViewActiveOnExplorer}
            onPressRenameAccount={handleOpenRenameActiveAccount}
            accounts={accounts}
            activeAccount={activeAccount}
            handleSelectAccount={handleSelectAccount}
            // The composite flag keeps rows and quick actions disabled through
            // the post-switch dismiss delay, not just while the auth store is
            // switching.
            isAccountSwitching={isSwitchInProgress}
            switchingToPublicKey={switchingToPublicKey}
            fiatTotals={fiatTotals}
            isLoadingFiatTotals={isLoadingFiatTotals}
          />
        }
      />
      <RenameAccountModal
        modalVisible={renameAccountModalVisible}
        setModalVisible={setRenameAccountModalVisible}
        handleRenameAccount={handleRenameAccount}
        account={accountToRename}
        isRenamingAccount={isRenamingAccount}
      />
    </>
  );
};

export default ManageAccounts;
