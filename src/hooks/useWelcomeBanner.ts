import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { ActiveAccount } from "ducks/auth";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseWelcomeBannerProps {
  account: ActiveAccount | null;
  isFunded: boolean;
  isLoadingBalances: boolean;
}

interface UseWelcomeBannerReturn {
  welcomeBannerBottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
  handleWelcomeBannerDismiss: () => Promise<void>;
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

  useEffect(() => {
    const checkWelcomeBannerStatus = async () => {
      if (account?.publicKey) {
        const hasSeenWelcome = await AsyncStorage.getItem(
          getWelcomeBannerShownKey(account.publicKey),
        );
        setHasAccountSeenWelcome(hasSeenWelcome === "true");
      }
    };
    checkWelcomeBannerStatus();
  }, [account?.publicKey]);

  // Check if welcome modal should be shown for new accounts
  const checkWelcomeBannerStatus = useCallback(() => {
    if (!account?.publicKey || isLoadingBalances) {
      return;
    }

    try {
      // Only show banner for unfunded accounts that haven't seen it before -> check for undefined->false to avoid showing banner on first load
      if (hasAccountSeenWelcome === false && !isFunded) {
        welcomeBannerBottomSheetModalRef.current?.present();
      }
    } catch (error) {
      logger.error("Error checking welcome banner status:", String(error));
    }
  }, [account?.publicKey, hasAccountSeenWelcome, isFunded, isLoadingBalances]);

  useEffect(() => {
    checkWelcomeBannerStatus();
  }, [checkWelcomeBannerStatus, isFunded, isLoadingBalances]);

  const handleWelcomeBannerDismiss = async () => {
    try {
      if (account?.publicKey) {
        await AsyncStorage.setItem(
          getWelcomeBannerShownKey(account.publicKey),
          "true",
        );
      }
    } catch (error) {
      logger.error("Error saving welcome banner status:", String(error));
    }
    welcomeBannerBottomSheetModalRef.current?.dismiss();
  };

  return {
    welcomeBannerBottomSheetModalRef,
    handleWelcomeBannerDismiss,
  };
};
