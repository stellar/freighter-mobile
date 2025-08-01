import Spinner from "components/Spinner";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Svg, Defs, Mask, Rect } from "react-native-svg";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from "react-native-vision-camera";
import { analytics } from "services/analytics";

const CUTOUT_SIZE = 232;
const CUTOUT_RADIUS = 32;
const CUTOUT_BORDER_WIDTH = 6;

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
  const { themeColors } = useColors();

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
      <View className="flex-1 justify-center items-center">
        <Spinner />
      </View>
    );
  }

  if (device == null || !hasPermission) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text sm secondary textAlign="center">
          {t("qrScanner.cameraNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
      />

      <View style={StyleSheet.absoluteFill}>
        {/* SVG Mask overlay with center cutout */}
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="cutout">
              <Rect width="100%" height="100%" fill="white" />
              <Rect
                x="50%"
                y="50%"
                width={CUTOUT_SIZE}
                height={CUTOUT_SIZE}
                rx={CUTOUT_RADIUS}
                ry={CUTOUT_RADIUS}
                fill="black"
                transform={[
                  { translateX: -CUTOUT_SIZE / 2 },
                  { translateY: -CUTOUT_SIZE / 2 },
                ]}
              />
            </Mask>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.8)"
            mask="url(#cutout)"
          />
        </Svg>

        {/* Border rectangle */}
        <View
          style={{
            position: "absolute",
            zIndex: 10,
            top: "50%",
            left: "50%",
            width: CUTOUT_SIZE,
            height: CUTOUT_SIZE,
            backgroundColor: "transparent",
            borderWidth: CUTOUT_BORDER_WIDTH,
            borderColor: themeColors.gold[9],
            borderRadius: CUTOUT_RADIUS,
            transform: [
              { translateX: -CUTOUT_SIZE / 2 },
              { translateY: -CUTOUT_SIZE / 2 },
            ],
          }}
        />
      </View>
    </>
  );
};
