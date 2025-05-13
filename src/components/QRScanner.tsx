import Spinner from "components/Spinner";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useState } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from "react-native-vision-camera";

/**
 * Props for the QRScanner component
 * @interface QRScannerProps
 * @property {(data: string) => void} onRead - Callback function called when a QR code is successfully scanned
 */
type QRScannerProps = {
  onRead: (data: string) => void;
};

/** Window width for camera view sizing */
const windowWidth = Dimensions.get("window").width;

/**
 * QR Scanner component that uses the device's camera to scan QR codes.
 * Handles camera permissions, device availability, and QR code detection.
 *
 * Features:
 * - Camera permission management
 * - Loading state handling
 * - Error state display
 * - QR code detection and callback
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
 * />
 * ```
 */
export const QRScanner: React.FC<QRScannerProps> = ({ onRead }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const { t } = useAppTranslation();

  const [isMounting, setIsMounting] = useState(true);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
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

  if (isMounting) {
    return (
      <View className="flex-1 justify-center items-center">
        <Spinner />
      </View>
    );
  }

  if (device == null || !hasPermission) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-white text-center mt-5">
          {t("qrScanner.cameraNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        height: "100%",
        width: windowWidth,
        marginLeft: -pxValue(DEFAULT_PADDING),
        overflow: "hidden",
      }}
    >
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
      />
    </View>
  );
};
