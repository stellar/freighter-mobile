import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NATIVE_TOKEN_CODE, QRCodeError, QRCodeSource } from "config/constants";
import {
  RootStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  SEND_PAYMENT_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useQRDataStore } from "ducks/qrData";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { parseQRPayload } from "helpers/qrValidation";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";

interface QRCodeScreenHandlers {
  handleQRCodeScanned: (data: string) => void;
  handleClose: () => void;
  handleHeaderLeft: () => void;
}

interface QRCodeScreenState {
  manualInput: string;
  isConnecting: boolean;
  error: string;
  showManualInput: false;
  title: string;
  scannerTitle: string;
  context: QRCodeSource.HOME_SCANNER;
}

interface QRCodeScreenReturn {
  handlers: QRCodeScreenHandlers;
  state: QRCodeScreenState;
}

const PAIRING_SUCCESS_DELAY_MS = 1000;
const PAIRING_ERROR_DELAY_MS = 500;

/**
 * Hook for the home screen QR code scanner.
 *
 * Handles both Stellar addresses (routes to send flow with XLM)
 * and WalletConnect URIs (pairs with dApp).
 *
 * @param enabled - When false, all effects are no-ops (used by useQRCodeScreenScanner
 *   to prevent inactive hooks from firing side effects)
 */
export const useHomeQrCodeScanner = (
  enabled: boolean,
): QRCodeScreenReturn => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isProcessingAddress, setIsProcessingAddress] = useState(false);
  const [isConnectingWC, setIsConnectingWC] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  const { clearQRData } = useQRDataStore();
  const { account } = useAuthenticationStore();

  const {
    searchAddress,
    isValidDestination,
    isSearching,
    searchResults,
    searchError,
    destinationAddress,
    federationAddress,
    federationMemo,
    federationMemoType,
    resetSendRecipient,
  } = useSendRecipientStore();
  const { saveRecipientAddress, saveMemo, saveMemoType } =
    useTransactionSettingsStore();

  const state: QRCodeScreenState = {
    manualInput: "",
    isConnecting: isConnectingWC || (isProcessingAddress && isSearching),
    error: "",
    showManualInput: false,
    title: t("homeScanner.title"),
    scannerTitle: t("homeScanner.scanQRCodeText"),
    context: QRCodeSource.HOME_SCANNER,
  };

  const handleClose = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  const handleHeaderLeft = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleQRCodeScanned = useCallback(
    (data: string) => {
      const payload = parseQRPayload(data, account?.publicKey);

      switch (payload.type) {
        case "stellar_address":
          setLastErrorCode(null);
          setIsProcessingAddress(true);
          searchAddress(payload.address);
          break;

        case "wallet_connect":
          setLastErrorCode(null);
          setIsConnectingWC(true);
          walletKit
            .pair({ uri: payload.uri })
            .then(() => {
              analytics.trackQRScanSuccess(QRCodeSource.HOME_SCANNER);
              setTimeout(() => {
                handleClose();
              }, PAIRING_SUCCESS_DELAY_MS);
            })
            .catch((err) => {
              setTimeout(() => {
                setIsConnectingWC(false);
                showToast({
                  variant: "error",
                  title:
                    err instanceof Error
                      ? err.message
                      : t("walletConnect.pairingError"),
                  duration: 3000,
                });
                analytics.trackQRScanError(
                  QRCodeSource.HOME_SCANNER,
                  "wallet_connect_pairing_failed",
                );
              }, PAIRING_ERROR_DELAY_MS);
            });
          break;

        case "invalid":
          if (lastErrorCode !== data) {
            showToast({
              variant: "error",
              title:
                payload.error === QRCodeError.SELF_SEND
                  ? t("sendPaymentScreen.cannotSendToSelf")
                  : t("sendPaymentScreen.invalidAddress"),
              duration: 3000,
            });
            analytics.trackQRScanError(
              QRCodeSource.HOME_SCANNER,
              payload.error,
            );
            setLastErrorCode(data);
          }
          break;

        default:
          break;
      }
    },
    [
      account?.publicKey,
      searchAddress,
      handleClose,
      showToast,
      t,
      lastErrorCode,
    ],
  );

  // Handle successful address resolution
  useEffect(() => {
    if (!enabled || !isProcessingAddress) return;

    if (isValidDestination && !isSearching && searchResults.length > 0) {
      saveRecipientAddress(destinationAddress);
      if (federationMemo) {
        saveMemo(federationMemo);
        saveMemoType(federationMemoType);
      } else {
        // Clear stale memos from previous sends to prevent old memo
        // from being carried into new send when scanned address has none
        saveMemo("");
        saveMemoType("");
      }
      analytics.trackQRScanSuccess(QRCodeSource.HOME_SCANNER);

      navigation.popToTop();
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
        screen: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
        params: {
          tokenId: NATIVE_TOKEN_CODE,
          recipientAddress: destinationAddress,
          // Pass federation address as recipientName so TransactionAmountScreen
          // displays user*domain label instead of raw G address
          recipientName: federationAddress || undefined,
        },
      });

      setIsProcessingAddress(false);
    }
  }, [
    enabled,
    isProcessingAddress,
    isValidDestination,
    isSearching,
    searchResults,
    destinationAddress,
    federationAddress,
    federationMemo,
    federationMemoType,
    saveRecipientAddress,
    saveMemo,
    saveMemoType,
    navigation,
  ]);

  // Handle address resolution errors
  useEffect(() => {
    if (!enabled || !isProcessingAddress) return;

    if (searchError && !isSearching) {
      showToast({
        variant: "error",
        title: searchError,
        duration: 3000,
      });
      analytics.trackQRScanError(
        QRCodeSource.HOME_SCANNER,
        "address_validation_failed",
      );
      setIsProcessingAddress(false);
    }
  }, [enabled, isProcessingAddress, searchError, isSearching, showToast]);

  // Reset search state on mount and clear QR data on unmount
  useEffect(() => {
    if (enabled) {
      resetSendRecipient();
    }
  }, [enabled, resetSendRecipient]);

  useEffect(() => () => clearQRData(), [clearQRData]);

  const handlers: QRCodeScreenHandlers = {
    handleQRCodeScanned,
    handleClose,
    handleHeaderLeft,
  };

  return {
    handlers,
    state,
  };
};
