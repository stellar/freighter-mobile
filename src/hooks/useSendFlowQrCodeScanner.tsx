import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { QRCodeSource } from "config/constants";
import { RootStackParamList } from "config/routes";
import { useQRDataStore } from "ducks/qrData";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback, useEffect } from "react";

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
  manualInput: "";
  /** Whether connection is in progress */
  isConnecting: false;
  /** Error message to display */
  error: "";
  /** Whether to show manual input overlay */
  showManualInput: false;
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
export const useSendFlowQrCodeScanner = (): QRCodeScreenReturn => {
  const { t } = useAppTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    scannedData,
    source: storedSource,
    isConsumed,
    consumeQRData,
    clearQRData,
  } = useQRDataStore();

  // Configuration for Send Flow
  const config: QRCodeScreenConfig = {
    showHeaderRight: false,
    usePopToTop: false,
  };

  // State for Send Flow
  const state: QRCodeScreenState = {
    manualInput: "",
    isConnecting: false,
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
  const handleQRCodeScanned = useCallback((data: string) => {
    // For send flow, save to store and let useEffect handle it
    const { setScannedData } = useQRDataStore.getState();
    setScannedData(data, QRCodeSource.ADDRESS_INPUT);
  }, []);

  // Handle scanned QR data when available
  useEffect(() => {
    if (
      scannedData &&
      storedSource === QRCodeSource.ADDRESS_INPUT &&
      !isConsumed
    ) {
      // For send flow, consume the data and navigate back
      consumeQRData();
      navigation.goBack();
    }
  }, [scannedData, storedSource, isConsumed, consumeQRData, navigation]);

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
