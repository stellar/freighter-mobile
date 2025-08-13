import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  bannerPresented: boolean;
  handleWelcomeBannerDismiss: () => Promise<void>;
}

export const useWelcomeBanner = ({
  account,
  isFunded,
  isLoadingBalances,
}: UseWelcomeBannerProps): UseWelcomeBannerReturn => {
  const welcomeBannerBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [bannerPresented, setBannerPresented] = useState(true);

  // Check if welcome modal should be shown for new accounts
  const checkWelcomeBannerStatus = useCallback(async () => {
    if (!account?.publicKey || isLoadingBalances) {
      return;
    }

    try {
      const hasSeenWelcome = await AsyncStorage.getItem(
        `welcomeBanner_shown_${account.publicKey}`,
      );

      // Only show banner for unfunded accounts that haven't seen it before
      if (!hasSeenWelcome && !isFunded) {
        // Set banner as presented immediately to prevent multiple presentations
        setBannerPresented(false);
        welcomeBannerBottomSheetModalRef.current?.present();
      }
    } catch (error) {
      logger.error("Error checking welcome banner status:", String(error));
    }
  }, [account?.publicKey, isFunded, isLoadingBalances]);

  useEffect(() => {
    checkWelcomeBannerStatus();
  }, [checkWelcomeBannerStatus, isFunded, isLoadingBalances]);

  const handleWelcomeBannerDismiss = async () => {
    try {
      if (account?.publicKey) {
        await AsyncStorage.setItem(
          `welcomeBanner_shown_${account.publicKey}`,
          "true",
        );
      }
    } catch (error) {
      logger.error("Error saving welcome banner status:", String(error));
    }
    welcomeBannerBottomSheetModalRef.current?.dismiss();
    setBannerPresented(true);
  };

  return {
    welcomeBannerBottomSheetModalRef,
    bannerPresented,
    handleWelcomeBannerDismiss,
  };
};
