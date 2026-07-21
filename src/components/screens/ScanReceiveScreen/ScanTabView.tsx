/* eslint-disable react/no-unstable-nested-components */
import { QRScanner } from "components/QRScanner";
import { QRCodeSource } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useQRCodeScreenScanner } from "hooks/useQRCodeScreenScanner";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OVERLAY_BOTTOM_GAP = 16;

interface ScanTabViewProps {
  /** Whether the Scan tab is currently active (drives the camera). */
  isActive: boolean;
}

/**
 * Headerless QR scanner body for the Scan tab of ScanReceiveScreen.
 *
 * Reuses the shared home-scanner logic (Stellar address + WalletConnect
 * handling, plus QR scan analytics) via useQRCodeScreenScanner. The parent
 * screen owns the header (X + Tabs), so this renders only the scanner and the
 * dev-only manual input overlay.
 */
export const ScanTabView: React.FC<ScanTabViewProps> = ({ isActive }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();

  const { handlers, state, ManualInputOverlay } = useQRCodeScreenScanner(
    QRCodeSource.HOME_SCANNER,
  );

  return (
    <>
      <QRScanner
        onRead={handlers.handleQRCodeScanned}
        context={state.context}
        title={state.scannerTitle}
        isActive={isActive}
      />

      {state.showManualInput &&
        handlers.handleManualInputChange &&
        ManualInputOverlay && (
          <View
            className="absolute inset-0 z-[100]"
            style={{
              paddingBottom: insets.bottom + pxValue(OVERLAY_BOTTOM_GAP),
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
