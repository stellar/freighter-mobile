import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WalletConnectManualInputOverlay } from "components/WalletConnectManualInputOverlay";
import { QRCodeSource } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useQRDataStore } from "ducks/qrData";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import React, { useState, useCallback, useEffect } from "react";

const PAIRING_SUCCESS_VISUALDELAY_MS = 1000;
const PAIRING_ERROR_VISUALDELAY_MS = 500;

interface QRCodeScreenHandlers {
  /** Function to handle QR code scanning */
  handleQRCodeScanned: (data: string) => void;
  /** Function to handle closing the screen */
  handleClose: () => void;
  /** Function to handle header left button press */
  handleHeaderLeft: () => void;
  /** Function to handle header right button press (if applicable) */
  handleHeaderRight?: () => void;
  /** Function to handle manual input changes */
  handleManualInputChange?: (text: string) => void;
  /** Function to handle connect button press (if applicable) */
  handleConnect?: () => void;
  /** Function to handle clear input (if applicable) */
  handleClearInput?: () => void;
  /** Function to handle paste from clipboard (if applicable) */
  handlePasteFromClipboard?: () => void;
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
  context: QRCodeSource;
}

interface QRCodeScreenConfig {
  /** Whether to show header right button */
  showHeaderRight: boolean;
  /** Whether to use popToTop for closing */
  usePopToTop: boolean;
}

interface QRCodeScreenReturn {
  handlers: QRCodeScreenHandlers;
  state: QRCodeScreenState;
  config: QRCodeScreenConfig;
  /** Manual input overlay component (only for WALLET_CONNECT context) */
  ManualInputOverlay?: React.ComponentType<{
    manualInput: string;
    onManualInputChange: (text: string) => void;
    onConnect: () => void;
    onClearInput: () => void;
    onPasteFromClipboard: () => void;
    isConnecting: boolean;
    error: string;
    themeColors: {
      text: {
        primary: string;
        secondary: string;
      };
      background: {
        secondary: string;
      };
    };
    t: ReturnType<typeof useAppTranslation>["t"];
  }>;
}

/**
 * Custom hook for QR Code Scanner Screen functionality
 *
 * This hook provides all the necessary state, handlers, and configuration
 * for the QRCodeScannerScreen based on the source parameter.
 *
 * @param source - The source/context of the QR scanner
 * @returns Object containing handlers, state, and configuration
 */
export const useQRCodeScreenScanner = (
  source: QRCodeSource,
): QRCodeScreenReturn => {
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isConnecting, setIsConnecting] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");

  const {
    scannedData,
    source: storedSource,
    isConsumed,
    consumeQRData,
    clearQRData,
  } = useQRDataStore();

  // Get the appropriate title based on source
  const getTitle = useCallback((): string => {
    switch (source) {
      case QRCodeSource.WALLET_CONNECT:
        return t("walletConnect.title");
      case QRCodeSource.ADDRESS_INPUT:
        return t("qrCodeScannerScreen.title");
      case QRCodeSource.IMPORT_WALLET:
        return t("qrCodeScannerScreen.title");

      default:
        return t("qrCodeScannerScreen.title");
    }
  }, [source, t]);

  // Get the appropriate context for analytics
  const getContext = useCallback((): QRCodeSource => {
    switch (source) {
      case QRCodeSource.WALLET_CONNECT:
        return QRCodeSource.WALLET_CONNECT;
      case QRCodeSource.ADDRESS_INPUT:
        return QRCodeSource.ADDRESS_INPUT;
      case QRCodeSource.IMPORT_WALLET:
        return QRCodeSource.IMPORT_WALLET;

      default:
        return QRCodeSource.ADDRESS_INPUT;
    }
  }, [source]);

  // Get the appropriate scanner title based on source
  const getScannerTitle = useCallback((): string => {
    switch (source) {
      case QRCodeSource.WALLET_CONNECT:
        return t("walletConnect.scanWCQrCode");
      case QRCodeSource.ADDRESS_INPUT:
        return t("sendPaymentScreen.scanQRCodeText");
      case QRCodeSource.IMPORT_WALLET:
        return t("qrCodeScannerScreen.title");
      default:
        return t("sendPaymentScreen.scanQRCodeText");
    }
  }, [source, t]);

  // Configuration based on source
  const config: QRCodeScreenConfig = {
    showHeaderRight: source === QRCodeSource.WALLET_CONNECT,
    usePopToTop: source === QRCodeSource.WALLET_CONNECT,
  };

  // State based on source
  const state: QRCodeScreenState = {
    manualInput,
    isConnecting,
    error,
    showManualInput: source === QRCodeSource.WALLET_CONNECT,
    title: getTitle(),
    scannerTitle: getScannerTitle(),
    context: getContext(),
  };

  // Handle closing the screen
  const handleClose = useCallback(() => {
    if (config.usePopToTop) {
      navigation.popToTop();
    } else {
      navigation.goBack();
    }
  }, [navigation, config.usePopToTop]);

  // Handle header left button press
  const handleHeaderLeft = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // Handle header right button press (for wallet connect)
  const handleHeaderRight = useCallback(() => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
      showNavigationAsCloseButton: true,
    });
  }, [navigation]);

  // Handle wallet connection
  const handleConnect = useCallback(
    async (uri: string) => {
      if (!uri) {
        setError(t("walletConnect.invalidUriError"));
        return;
      }

      setIsConnecting(true);
      setError("");

      try {
        await walletKit.pair({ uri });

        setTimeout(() => {
          handleClose();
        }, PAIRING_SUCCESS_VISUALDELAY_MS);
      } catch (err) {
        setTimeout(() => {
          setIsConnecting(false);
          setError(
            err instanceof Error
              ? err.message
              : t("walletConnect.pairingError"),
          );
        }, PAIRING_ERROR_VISUALDELAY_MS);
      }
    },
    [t, handleClose],
  );

  // Handle QR code scanning
  const handleQRCodeScanned = useCallback(
    (data: string) => {
      if (source === QRCodeSource.WALLET_CONNECT) {
        // For wallet connect, set the manual input
        setManualInput(data);
      } else {
        // For other sources, save to store and let useEffect handle it
        const { setScannedData } = useQRDataStore.getState();
        setScannedData(data, source);
      }
    },
    [source],
  );

  // Handle manual input changes
  const handleManualInputChange = useCallback((text: string) => {
    setManualInput(text);
  }, []);

  // Handle connect button press
  const handleConnectPress = useCallback(() => {
    handleConnect(manualInput);
  }, [handleConnect, manualInput]);

  // Handle clear input
  const handleClearInput = useCallback(() => {
    setManualInput("");
    setError("");
  }, []);

  // Handle paste from clipboard
  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then(setManualInput);
  }, [getClipboardText]);

  // Handle scanned QR data when available
  useEffect(() => {
    if (scannedData && storedSource === source && !isConsumed) {
      if (source === QRCodeSource.WALLET_CONNECT) {
        // For wallet connect, set the manual input and consume the data
        setManualInput(scannedData);
        consumeQRData();
      } else {
        // For other sources, consume the data and navigate back
        consumeQRData();
        navigation.goBack();
      }
    }
  }, [
    scannedData,
    storedSource,
    isConsumed,
    consumeQRData,
    source,
    navigation,
  ]);

  // Clear QR data when component unmounts
  useEffect(() => clearQRData(), [clearQRData]);

  // Build handlers object based on source
  const handlers: QRCodeScreenHandlers = {
    handleQRCodeScanned,
    handleClose,
    handleHeaderLeft,
    ...(config.showHeaderRight && { handleHeaderRight }),
    ...(state.showManualInput && {
      handleManualInputChange,
      handleConnect: handleConnectPress,
      handleClearInput,
      handlePasteFromClipboard,
    }),
  };

  return {
    handlers,
    state,
    config,
    ...(source === QRCodeSource.WALLET_CONNECT && {
      ManualInputOverlay: WalletConnectManualInputOverlay,
    }),
  };
};
