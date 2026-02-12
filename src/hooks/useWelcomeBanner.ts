import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { ActiveAccount } from "ducks/auth";
import { isE2ETest } from "helpers/isEnv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseWelcomeBannerProps {
  account: ActiveAccount | null;
  isFunded: boolean;
  isLoadingBalances: boolean;
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
}: UseWelcomeBannerProps): UseWelcomeBannerReturn => {
  const welcomeBannerBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [hasAccountSeenWelcome, setHasAccountSeenWelcome] = useState<
    boolean | undefined
  >(undefined);

  // Memoize the storage key to avoid recreating it on every render
  const welcomeBannerShownKey = useMemo(
    () =>
      account?.publicKey ? getWelcomeBannerShownKey(account.publicKey) : null,
    [account?.publicKey],
  );

  useEffect(() => {
    const checkWelcomeBannerStatus = async () => {
      setHasAccountSeenWelcome(undefined);
      if (isE2ETest) {
        setHasAccountSeenWelcome(true);
        return;
      }
      if (welcomeBannerShownKey) {
        const hasSeenWelcome = await AsyncStorage.getItem(
          welcomeBannerShownKey,
        );
        setHasAccountSeenWelcome(hasSeenWelcome === "true");
      }
    };
    checkWelcomeBannerStatus();
  }, [welcomeBannerShownKey]);

  // Check if welcome modal should be shown for new accounts
  const checkWelcomeBannerStatus = useCallback(() => {
    if (isE2ETest) {
      return;
    }
    if (!account?.publicKey || isLoadingBalances) {
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
  }, [account?.publicKey, hasAccountSeenWelcome, isFunded, isLoadingBalances]);

  useEffect(() => {
    checkWelcomeBannerStatus();
  }, [checkWelcomeBannerStatus, isFunded, isLoadingBalances]);

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
