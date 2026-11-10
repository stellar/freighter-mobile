import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import BottomSheet from "components/BottomSheet";
import AddWalletFooter from "components/screens/HomeScreen/AddWalletFooter";
import ManageAccountBottomSheet, {
  ManageAccountSheetHeader,
} from "components/screens/HomeScreen/ManageAccountBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { ERROR_TOAST_DURATION } from "config/constants";
import { logger } from "config/logger";
import { RootStackParamList, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { Account, SecretSource } from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";
import { getSecretSources } from "services/auth/secretSources";

interface ManageAccountsProps {
  accounts: Account[];
  activeAccount: ActiveAccount | null;
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  showAddWallet?: boolean;
  isLoadingAccounts?: boolean;
}

const ACCOUNT_SWITCH_DISMISS_DELAY_MS = 500;

/**
 * Manage-accounts (wallets) bottom sheet orchestrator: owns the sheet
 * lifecycle and its actions: copying the active address, account switching
 * with its post-switch dismiss delay, and the "+ Add wallet" footer. Reads the
 * wallet's secret sources so the list can group by them. Presents through
 * the shared BottomSheet in scrollable mode with a pinned header/footer,
 * and triggers the TTL-gated per-account USD totals fetch on present.
 */
const ManageAccounts: React.FC<ManageAccountsProps> = ({
  accounts,
  activeAccount,
  bottomSheetRef,
  showAddWallet = true,
  isLoadingAccounts = false,
}) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { network, selectAccount, isSwitchingAccount } =
    useAuthenticationStore();
  const fiatTotals = useAccountsFiatTotalsStore((state) => state.fiatTotals);
  const isLoadingFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.isLoading,
  );
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );
  const { copyToClipboard } = useClipboard();
  const { showToast } = useToast();
  const { t } = useAppTranslation();

  const [sources, setSources] = useState<SecretSource[] | null>(null);
  const [switchingToPublicKey, setSwitchingToPublicKey] = useState<
    string | null
  >(null);

  // Read while the sheet is still closed (Home keeps this mounted), and again
  // when the list changes, so the groups are ready when it opens.
  useEffect(() => {
    getSecretSources()
      .then((map) => setSources(Object.values(map)))
      .catch((error) => {
        logger.error("ManageAccounts", "Failed to read secret sources", error);
        // Still list the wallets, under the trailing group.
        setSources((current) => current ?? []);
      });
  }, [accounts]);

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
        // Silent background refresh; the store's TTL keeps frequent
        // open/close cycles from spamming requests.
        fetchAccountsFiatTotals({
          publicKeys: accounts.map((account) => account.publicKey),
          network,
          excludePublicKey: activeAccount?.publicKey,
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

  const handleCopyActiveAddress = useCallback(() => {
    if (!activeAccount) {
      return;
    }

    copyToClipboard(activeAccount.publicKey, {
      notificationMessage: t("accountAddressCopied"),
    });

    analytics.trackCopyPublicKey();
  }, [activeAccount, copyToClipboard, t]);

  const handleAddAnotherWallet = useCallback(() => {
    if (!navigation) return;

    // account.created (ACCOUNT_SCREEN_ADD_ACCOUNT) fires on the actual
    // creation-success path (ducks/auth createAccount), not here at tap time —
    // so it isn't counted when the add flow is abandoned.
    bottomSheetRef.current?.dismiss();
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK);
  }, [navigation, bottomSheetRef]);

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

        // A switch is one of the few moments the whole list refreshes;
        // background fire-and-forget, skipping the now-active account
        // (synced from the app's own balances).
        fetchAccountsFiatTotals({
          publicKeys: accounts.map((account) => account.publicKey),
          network,
          forceRefresh: true,
          excludePublicKey: publicKey,
        });

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
      accounts,
      network,
      fetchAccountsFiatTotals,
    ],
  );

  const handleCloseModal = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

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

  // Scrollable mode (same recipe as the history details sheet): the pinned
  // header/footer live inside the sheet's content tree, so the whole sheet
  // slides in as one unit, and dynamic sizing measures the content before
  // animating.
  return (
    <BottomSheet
      modalRef={bottomSheetRef}
      scrollable
      analyticsEvent={AnalyticsEvent.VIEW_MANAGE_WALLETS}
      bottomSheetModalProps={{ onChange: handleSheetPresent }}
      scrollViewHeaderComponent={renderSheetHeader}
      scrollViewFooterComponent={
        showAddWallet ? renderAddWalletFooter : undefined
      }
      customContent={
        <ManageAccountBottomSheet
          onPressCopyAddress={handleCopyActiveAddress}
          accounts={accounts}
          sources={sources}
          activeAccount={activeAccount}
          handleSelectAccount={handleSelectAccount}
          // The composite flag keeps rows and the copy button disabled through
          // the post-switch dismiss delay, not just while the auth store is
          // switching.
          isAccountSwitching={isSwitchInProgress}
          switchingToPublicKey={switchingToPublicKey}
          fiatTotals={fiatTotals}
          isLoadingFiatTotals={isLoadingFiatTotals}
        />
      }
    />
  );
};

export default ManageAccounts;
