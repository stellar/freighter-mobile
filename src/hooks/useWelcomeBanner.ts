import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { ActiveAccount } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseWelcomeBannerProps {
  account: ActiveAccount | null;
  isFunded: boolean;
  isLoadingBalances: boolean;
  isSwitchingAccount: boolean;
}

interface UseWelcomeBannerReturn {
  welcomeBannerBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  handleWelcomeBannerDismiss: () => void;
}

const getWelcomeBannerShownKey = (publicKey: string) =>
  `${STORAGE_KEYS.WELCOME_BANNER_SHOWN_PREFIX}${publicKey}`;

export const useWelcomeBanner = ({
  account,
  isFunded,
  isLoadingBalances,
  isSwitchingAccount,
}: UseWelcomeBannerProps): UseWelcomeBannerReturn => {
  const welcomeBannerBottomSheetModalRef = useRef<BottomSheetModal>(null);
  // Which account the current balances snapshot was fetched for — right
  // after clearAccountData (account create/import/switch) the store is
  // empty with a null stamp, and deciding fundedness from that transient
  // state would present the banner for accounts that are actually funded.
  const fetchedPublicKey = useBalancesStore((state) => state.fetchedPublicKey);
  const [hasAccountSeenWelcome, setHasAccountSeenWelcome] = useState<
    boolean | undefined
  >(undefined);
  const [accountSwitchCompleted, setAccountSwitchCompleted] =
    useState<boolean>(false);

  // Memoize the storage key to avoid recreating it on every render
  const welcomeBannerShownKey = useMemo(
    () =>
      account?.publicKey ? getWelcomeBannerShownKey(account.publicKey) : null,
    [account?.publicKey],
  );

  useEffect(() => {
    const checkWelcomeBannerStatus = async () => {
      setHasAccountSeenWelcome(undefined);
      if (welcomeBannerShownKey) {
        const hasSeenWelcome = await AsyncStorage.getItem(
          welcomeBannerShownKey,
        );
        setHasAccountSeenWelcome(hasSeenWelcome === "true");
      }
    };
    checkWelcomeBannerStatus();
  }, [welcomeBannerShownKey]);

  // Track when account switching completes and balances are loaded
  useEffect(() => {
    if (!isSwitchingAccount && !isLoadingBalances) {
      setAccountSwitchCompleted(true);
    } else if (isSwitchingAccount) {
      setAccountSwitchCompleted(false);
    }
  }, [isSwitchingAccount, isLoadingBalances]);

  // Check if welcome modal should be shown for new accounts
  const checkWelcomeBannerStatus = useCallback(() => {
    // Only check when account switching is complete AND balances are loaded
    // AND the loaded snapshot actually belongs to this account — isFunded
    // is meaningless (cleared to false) until then.
    if (
      !account?.publicKey ||
      isLoadingBalances ||
      isSwitchingAccount ||
      !accountSwitchCompleted ||
      fetchedPublicKey !== account.publicKey
    ) {
      return;
    }

    try {
      // Only show banner for unfunded accounts that haven't seen it before -> check for undefined->false to avoid showing banner on first load
      if (hasAccountSeenWelcome === false && !isFunded) {
        welcomeBannerBottomSheetModalRef.current?.present();
      }
    } catch (error) {
      logger.error(
        "[useWelcomeBanner]",
        "Error checking welcome banner status:",
        error,
      );
    }
  }, [
    account?.publicKey,
    hasAccountSeenWelcome,
    isFunded,
    isLoadingBalances,
    isSwitchingAccount,
    accountSwitchCompleted,
    fetchedPublicKey,
  ]);

  useEffect(() => {
    checkWelcomeBannerStatus();
  }, [
    checkWelcomeBannerStatus,
    isFunded,
    isLoadingBalances,
    isSwitchingAccount,
    accountSwitchCompleted,
  ]);

  const handleWelcomeBannerDismiss = useCallback(async () => {
    try {
      if (welcomeBannerShownKey) {
        await AsyncStorage.setItem(welcomeBannerShownKey, "true");
      }
      setHasAccountSeenWelcome(true);
    } catch (error) {
      logger.error(
        "[useWelcomeBanner]",
        "Error saving welcome banner status:",
        error,
      );
    }
    welcomeBannerBottomSheetModalRef.current?.dismiss();
  }, [welcomeBannerShownKey]);

  // Memoize the return object to prevent unnecessary re-renders
  const returnValue = useMemo(
    () => ({
      welcomeBannerBottomSheetModalRef,
      handleWelcomeBannerDismiss,
    }),
    [handleWelcomeBannerDismiss],
  );

  return returnValue;
};
