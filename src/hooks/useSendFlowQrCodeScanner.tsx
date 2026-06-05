import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { QRCodeSource } from "config/constants";
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
import useAppTranslation from "hooks/useAppTranslation";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";

interface QRCodeScreenHandlers {
  /** Function to handle QR code scanning */
  handleQRCodeScanned: (data: string) => void;
  /** Function to handle closing the screen */
  handleClose: () => void;
  /** Function to handle header left button press */
  handleHeaderLeft: () => void;
}

interface QRCodeScreenState {
  /** Current manual input value */
  manualInput: string;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Error message to display */
  error: string;
  /** Whether to show manual input overlay */
  showManualInput: boolean;
  /** Title for the screen */
  title: string;
  /** Title for the QR scanner overlay */
  scannerTitle: string;
  /** Context for analytics */
  context: QRCodeSource.ADDRESS_INPUT;
}

interface QRCodeScreenConfig {
  /** Whether to show header right button */
  showHeaderRight: false;
  /** Whether to use popToTop for closing */
  usePopToTop: false;
}

interface QRCodeScreenReturn {
  handlers: QRCodeScreenHandlers;
  state: QRCodeScreenState;
  config: QRCodeScreenConfig;
  /** Manual input overlay component (not used for send flow) */
  ManualInputOverlay?: undefined;
}

/**
 * Custom hook for Send Flow QR Code Scanner Screen functionality
 *
 * This hook provides all the necessary state, handlers, and configuration
 * specifically for address input in the send flow.
 *
 * @returns Object containing handlers, state, and configuration
 */
export const useSendFlowQrCodeScanner = (
  enabled: boolean,
): QRCodeScreenReturn => {
  const { t } = useAppTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isProcessingQRScan, setIsProcessingQRScan] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  const { clearQRData } = useQRDataStore();
  const { account } = useAuthenticationStore();
  const { showToast } = useToast();

  const {
    searchAddress,
    searchResults,
    isValidDestination,
    isSearching,
    destinationAddress,
  } = useSendRecipientStore();
  const { saveRecipientAddress, selectedTokenId, selectedCollectibleDetails } =
    useTransactionSettingsStore();

  // Configuration for Send Flow
  const config: QRCodeScreenConfig = {
    showHeaderRight: false,
    usePopToTop: false,
  };

  // State for Send Flow
  const state: QRCodeScreenState = {
    manualInput: "",
    isConnecting: isProcessingQRScan && isSearching,
    error: "",
    showManualInput: false,
    title: t("qrCodeScannerScreen.title"),
    scannerTitle: t("sendPaymentScreen.scanQRCodeText"),
    context: QRCodeSource.ADDRESS_INPUT,
  };

  // Handle closing the screen
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle header left button press
  const handleHeaderLeft = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // Handle QR code scanning
  const handleQRCodeScanned = useCallback(
    (data: string) => {
      const payload = parseQRPayload(data);

      // Handle valid Stellar address
      if (payload.type === "stellar_address") {
        // Check for self-send
        if (payload.address === account?.publicKey) {
          if (lastErrorCode !== data) {
            showToast({
              variant: "error",
              title: t("sendPaymentScreen.cannotSendToSelf"),
              duration: 3000,
            });
            setLastErrorCode(data);
          }
          return;
        }

        setLastErrorCode(null);
        setIsProcessingQRScan(true);
        searchAddress(payload.address);
        analytics.trackQRScanSuccess(QRCodeSource.ADDRESS_INPUT);
        return;
      }

      // Handle errors - invalid format (including WC URIs in send flow)
      if (lastErrorCode !== data) {
        showToast({
          variant: "error",
          title: t("sendPaymentScreen.invalidAddress"),
          duration: 3000,
        });
        setLastErrorCode(data);
      }
    },
    [searchAddress, account?.publicKey, showToast, t, lastErrorCode],
  );

  // Handle search results when QR scan is processed
  useEffect(() => {
    if (!enabled) return;
    if (
      isProcessingQRScan &&
      isValidDestination &&
      !isSearching &&
      searchResults.length > 0
    ) {
      // Save the recipient address to transaction settings store
      // The send recipient store already has the correct address from the search
      saveRecipientAddress(destinationAddress);

      // Pop to main tab first to remove the QR scanner screen from the stack, then navigate to send payment stack
      navigation.popToTop();

      const isCollectibleFlow = !!selectedCollectibleDetails?.tokenId;

      if (isCollectibleFlow) {
        // Route collectible sends to the collectible review screen,
        // not the token amount screen (which would force-select XLM).
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
          screen: SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
          params: {
            collectionAddress: selectedCollectibleDetails.collectionAddress,
            tokenId: selectedCollectibleDetails.tokenId,
          },
        });
      } else {
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
          screen: SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN,
          params: {
            tokenId: selectedTokenId,
            recipientAddress: destinationAddress,
          },
        });
      }

      // Reset the processing flag
      setIsProcessingQRScan(false);
    }
  }, [
    enabled,
    isProcessingQRScan,
    isValidDestination,
    isSearching,
    searchResults,
    destinationAddress,
    saveRecipientAddress,
    selectedTokenId,
    selectedCollectibleDetails,
    navigation,
  ]);

  // Clear QR data when component unmounts
  useEffect(() => clearQRData(), [clearQRData]);

  // Build handlers object
  const handlers: QRCodeScreenHandlers = {
    handleQRCodeScanned,
    handleClose,
    handleHeaderLeft,
  };

  return {
    handlers,
    state,
    config,
  };
};
