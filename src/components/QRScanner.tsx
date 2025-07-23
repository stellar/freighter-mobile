import Spinner from "components/Spinner";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from "react-native-vision-camera";
import { analytics } from "services/analytics";

/**
 * Props for the QRScanner component
 * @interface QRScannerProps
 * @property {(data: string) => void} onRead - Callback function called when a QR code is successfully scanned
 * @property {string} [context] - Context for analytics tracking
 */
type QRScannerProps = {
  onRead: (data: string) => void;
  context?: "wallet_connect" | "address_input" | "import_wallet";
};

/**
 * QR Scanner component that uses the device's camera to scan QR codes.
 * Handles camera permissions, device availability, and QR code detection.
 *
 * Features:
 * - Camera permission management
 * - Loading state handling
 * - Error state display
 * - QR code detection and callback
 * - Analytics tracking for mobile-specific usage
 *
 * @component
 * @param {QRScannerProps} props - The component props
 * @returns {JSX.Element} The QR scanner component
 *
 * @example
 * ```tsx
 * <QRScanner
 *   onRead={(data) => {
 *     console.log('Scanned QR code:', data);
 *   }}
 *   context="wallet_connect"
 * />
 * ```
 */
export const QRScanner: React.FC<QRScannerProps> = ({
  onRead,
  context = "wallet_connect",
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const { t } = useAppTranslation();

  const [isMounting, setIsMounting] = useState(true);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        analytics.trackQRScanSuccess(context);

        onRead(codes[0].value);
      }
    },
  });

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    setTimeout(() => {
      setIsMounting(false);
    }, 500);
  }, []);

  useEffect(() => {
    // Track error if permissions denied or camera unavailable (mobile-specific feature)
    if (!isMounting && (device == null || !hasPermission)) {
      const error = device == null ? "camera_unavailable" : "permission_denied";

      analytics.trackQRScanError(error, context);
    }
  }, [isMounting, device, hasPermission, context]);

  if (isMounting) {
    return (
      <View className="flex-1 mt-40 items-center">
        <Spinner />
      </View>
    );
  }

  if (device == null || !hasPermission) {
    return (
      <View className="flex-1 mt-40 items-center">
        <Text sm secondary textAlign="center">
          {t("qrScanner.cameraNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View className="h-[300px] w-[300px] overflow-hidden rounded-[32px]">
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
      />
    </View>
  );
};
