import { QRCodeSource } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useSendFlowQrCodeScanner } from "hooks/useSendFlowQrCodeScanner";
import { useWalletConnectQrCodeScanner } from "hooks/useWalletConnectQrCodeScanner";
import React from "react";

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
 * This hook acts as a wrapper that delegates to context-specific hooks
 * based on the source parameter. Each context has its own specialized hook
 * that provides the appropriate functionality.
 *
 * @param source - The source/context of the QR scanner
 * @returns Object containing handlers, state, and configuration
 */
export const useQRCodeScreenScanner = (
  source: QRCodeSource,
): QRCodeScreenReturn => {
  // Call all hooks to satisfy React Hooks rules
  const walletConnectResult = useWalletConnectQrCodeScanner();
  const sendFlowResult = useSendFlowQrCodeScanner();

  // Return the appropriate result based on source
  switch (source) {
    case QRCodeSource.WALLET_CONNECT:
      return walletConnectResult;

    case QRCodeSource.ADDRESS_INPUT:
      return sendFlowResult;

    case QRCodeSource.IMPORT_WALLET:
      throw new Error("Import wallet QR code scanner not implemented");

    default:
      // Default to send flow for unknown sources
      return sendFlowResult;
  }
};
