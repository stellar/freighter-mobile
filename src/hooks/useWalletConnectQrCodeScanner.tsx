import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WalletConnectManualInputOverlay } from "components/WalletConnectManualInputOverlay";
import { QRCodeSource } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useQRDataStore } from "ducks/qrData";
import { isValidWalletConnectURI } from "helpers/qrValidation";
import { walletKit } from "helpers/walletKitUtil";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import React, { useState, useCallback, useEffect } from "react";
import { analytics } from "services/analytics";

const PAIRING_SUCCESS_VISUALDELAY_MS = 1000;
const PAIRING_ERROR_VISUALDELAY_MS = 500;

interface QRCodeScreenHandlers {
  /** Function to handle QR code scanning */
  handleQRCodeScanned: (data: string) => void;
  /** Function to handle closing the screen */
  handleClose: () => void;
  /** Function to handle header left button press */
  handleHeaderLeft: () => void;
  /** Function to handle header right button press */
  handleHeaderRight: () => void;
  /** Function to handle manual input changes */
  handleManualInputChange: (text: string) => void;
  /** Function to handle connect button press */
  handleConnect: () => void;
  /** Function to handle clear input */
  handleClearInput: () => void;
  /** Function to handle paste from clipboard */
  handlePasteFromClipboard: () => void;
}

interface QRCodeScreenState {
  /** Current manual input value */
  manualInput: string;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Error message to display */
  error: string;
  /** Whether to show manual input overlay */
  showManualInput: true;
  /** Title for the screen */
  title: string;
  /** Title for the QR scanner overlay */
  scannerTitle: string;
  /** Context for analytics */
  context: QRCodeSource.WALLET_CONNECT;
}

interface QRCodeScreenConfig {
  /** Whether to show header right button */
  showHeaderRight: true;
}

interface QRCodeScreenReturn {
  handlers: QRCodeScreenHandlers;
  state: QRCodeScreenState;
  config: QRCodeScreenConfig;
  /** Manual input overlay component */
  ManualInputOverlay: React.ComponentType<{
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
 * Custom hook for WalletConnect QR Code Scanner Screen functionality
 *
 * This hook provides all the necessary state, handlers, and configuration
 * specifically for WalletConnect QR code scanning.
 *
 * @returns Object containing handlers, state, and configuration
 */
export const useWalletConnectQrCodeScanner = (): QRCodeScreenReturn => {
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
    setScannedData,
    clearQRData,
  } = useQRDataStore();

  // Configuration for WalletConnect
  const config: QRCodeScreenConfig = {
    showHeaderRight: true,
  };

  // State for WalletConnect
  const state: QRCodeScreenState = {
    manualInput,
    isConnecting,
    error,
    showManualInput: true,
    title: t("walletConnect.title"),
    scannerTitle: t("walletConnect.scanWCQrCode"),
    context: QRCodeSource.WALLET_CONNECT,
  };

  // Handle closing the screen
  const handleClose = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

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

  // Handle connect button press
  const handleConnectPress = useCallback(() => {
    handleConnect(manualInput);
  }, [handleConnect, manualInput]);

  // Handle QR code scanning
  const handleQRCodeScanned = useCallback(
    (data: string) => {
      // Set the scanned data in the store so the useEffect can process it
      setScannedData(data, QRCodeSource.WALLET_CONNECT);
    },
    [setScannedData],
  );

  // Handle manual input changes
  const handleManualInputChange = useCallback(
    (text: string) => {
      setManualInput(text);

      // Validate manual input and show error if invalid
      if (text.trim() && !isValidWalletConnectURI(text)) {
        setError(t("walletConnect.invalidUriError"));
      } else {
        setError(""); // Clear error for valid input or empty input
      }
    },
    [t],
  );

  // Handle clear input
  const handleClearInput = useCallback(() => {
    setManualInput("");
    setError("");
  }, []);

  // Handle paste from clipboard
  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then((text) => {
      setManualInput(text);

      // Validate pasted content and show error if invalid
      if (text.trim() && !isValidWalletConnectURI(text)) {
        setError(t("walletConnect.invalidUriError"));
      } else {
        setError(""); // Clear error for valid input or empty input
      }
    });
  }, [getClipboardText, t]);

  // Handle scanned QR data when available
  useEffect(() => {
    if (
      scannedData &&
      storedSource === QRCodeSource.WALLET_CONNECT &&
      !isConsumed
    ) {
      // Validate that the scanned data is a valid WalletConnect URI
      if (isValidWalletConnectURI(scannedData)) {
        setManualInput(scannedData);
        setError(""); // Clear any previous errors
        // Track analytics
        analytics.trackQRScanSuccess(QRCodeSource.WALLET_CONNECT);
        // Automatically connect when a valid WalletConnect URI is scanned
        // Call handleConnect directly with the scanned data instead of relying on manualInput state
        handleConnect(scannedData);
      }
      // For scanned QR codes, don't show errors - just ignore invalid ones silently
      // Always clear the QR data to allow continuous scanning
      clearQRData();
    }
  }, [scannedData, storedSource, isConsumed, clearQRData, handleConnect]);

  // Clear QR data when component unmounts
  useEffect(() => clearQRData(), [clearQRData]);

  // Build handlers object
  const handlers: QRCodeScreenHandlers = {
    handleQRCodeScanned,
    handleClose,
    handleHeaderLeft,
    handleHeaderRight,
    handleManualInputChange,
    handleConnect: handleConnectPress,
    handleClearInput,
    handlePasteFromClipboard,
  };

  return {
    handlers,
    state,
    config,
    ManualInputOverlay: WalletConnectManualInputOverlay,
  };
};
