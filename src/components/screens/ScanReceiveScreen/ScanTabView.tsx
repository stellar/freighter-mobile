/* eslint-disable react/no-unstable-nested-components */
import { QRScanner } from "components/QRScanner";
import { DEFAULT_PADDING, QRCodeSource } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useQRCodeScreenScanner } from "hooks/useQRCodeScreenScanner";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** No-op used to ignore scanned codes while the Scan tab is not active. */
const IGNORE_SCAN = () => {};

interface ScanTabViewProps {
  /**
   * Keep the camera session alive. Stays true across a tab switch so the
   * preview does not tear down and re-initialize (which would blink); tie it to
   * screen focus so the camera still stops when navigating away.
   */
  cameraActive: boolean;
  /**
   * Whether scanned codes should be handled. Only true on the Scan tab, so the
   * still-running camera behind the Receive tab cannot trigger a navigation.
   */
  isScanning: boolean;
}

/**
 * Headerless QR scanner body for the Scan tab of ScanReceiveScreen.
 *
 * Reuses the shared home-scanner logic (Stellar address + WalletConnect
 * handling, plus QR scan analytics) via useQRCodeScreenScanner. The parent
 * screen owns the header (X + Tabs), so this renders only the scanner and the
 * dev-only manual input overlay.
 */
export const ScanTabView: React.FC<ScanTabViewProps> = ({
  cameraActive,
  isScanning,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();

  const { handlers, state, ManualInputOverlay } = useQRCodeScreenScanner(
    QRCodeSource.HOME_SCANNER,
  );

  return (
    <>
      <QRScanner
        onRead={isScanning ? handlers.handleQRCodeScanned : IGNORE_SCAN}
        context={state.context}
        title={state.scannerTitle}
        isActive={cameraActive}
      />

      {state.showManualInput &&
        handlers.handleManualInputChange &&
        ManualInputOverlay && (
          <View
            className="absolute inset-0 z-[100] px-5"
            style={{
              paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING),
            }}
            pointerEvents="box-none"
          >
            <ManualInputOverlay
              manualInput={state.manualInput}
              onManualInputChange={handlers.handleManualInputChange}
              onConnect={handlers.handleConnect!}
              onClearInput={handlers.handleClearInput!}
              onPasteFromClipboard={handlers.handlePasteFromClipboard!}
              isConnecting={state.isConnecting}
              error={state.error}
              themeColors={themeColors}
              t={t}
            />
          </View>
        )}
    </>
  );
};
