/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { QRScanner } from "components/QRScanner";
import { BaseLayout } from "components/layout/BaseLayout";
import CameraNavigationHeader from "components/layout/CameraNavigationHeader";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import Icon from "components/sds/Icon";
import { getDefaultQRCodeSource } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import {
  useQRCodeScreenScanner,
  QRCodeManualInputOverlay,
} from "hooks/useQRCodeScreenScanner";
import React from "react";

type ScanQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN
>;

/**
 * ScanQRCodeScreen Component
 *
 * A flexible QR code scanning screen that can be used for different purposes:
 * - "address_input": For scanning addresses in Send flow
 * - "wallet_connect": For scanning WalletConnect URIs
 * - "import_wallet": For scanning wallet import data
 *
 * The screen uses the useQRCodeScreenScanner hook to handle all logic based on the source parameter.
 *
 * @param {ScanQRCodeScreenProps} props - Component props including navigation
 * @returns {JSX.Element} The rendered component
 */
const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ route }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  // Get the source from route params, default to address_input
  const source = route.params?.source || getDefaultQRCodeSource();

  // Use the custom hook to get all handlers, state, and configuration
  const { handlers, state, config } = useQRCodeScreenScanner(source);

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <CameraNavigationHeader
        headerTitle={state.title}
        headerLeft={() => (
          <CustomHeaderButton
            icon={Icon.X}
            onPress={handlers.handleHeaderLeft}
          />
        )}
        headerRight={
          config.showHeaderRight && handlers.handleHeaderRight
            ? () => (
                <CustomHeaderButton
                  position="right"
                  icon={Icon.QrCode01}
                  onPress={handlers.handleHeaderRight}
                />
              )
            : undefined
        }
      />

      {state.showManualInput && handlers.handleManualInputChange && (
        <QRCodeManualInputOverlay
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
      )}

      <QRScanner
        onRead={handlers.handleQRCodeScanned}
        context={state.context}
      />
    </BaseLayout>
  );
};

export default ScanQRCodeScreen;
