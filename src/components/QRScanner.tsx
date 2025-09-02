import { Text } from "components/sds/Typography";
import { QRCodeSource } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Svg, Defs, Mask, Rect } from "react-native-svg";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
  Code,
} from "react-native-vision-camera";
import { analytics } from "services/analytics";

const MOUNTING_DELAY = 500;
const SCAN_DEBOUNCE_MS = 1000; // Prevent multiple scans of the same code within 1 second

const CUTOUT_TOP_OFFSET = "45%";
const CUTOUT_SIZE = 232;
const CUTOUT_RADIUS = 32;
const CUTOUT_BORDER_WIDTH = 6;
const CUTOUT_TEXT_TOP_OFFSET = 33;

const ABOVE_OVERLAY_Z_INDEX = 10;

/**
 * Props for the QRScanner component
 * @interface QRScannerProps
 * @property {(data: string) => void} onRead - Callback function called when a QR code is successfully scanned
 * @property {QRCodeSource} [context] - Context for analytics tracking
 * @property {string} title - Title text to display in the scanner overlay
 */
type QRScannerProps = {
  onRead: (data: string) => void;
  context?: QRCodeSource;
  title: string;
};

/**
 * QR Scanner component that uses the device's camera to scan QR codes.
 *
 * This component provides a full-screen camera interface with a custom overlay
 * that includes a centered cutout area for QR code scanning. It handles camera
 * permissions, device availability, and provides real-time QR code detection.
 *
 * Features:
 * - Camera permission management with automatic request
 * - Custom SVG mask overlay with rounded cutout
 * - Gold border guide around the scanning area
 * - Instructional text below the scanning area
 * - Loading and error state handling
 * - QR code detection with callback
 * - Analytics tracking for success/error events
 * - Mounting delay to prevent UI flickering
 *
 * @component
 * @param {QRScannerProps} props - The component props
 * @returns {JSX.Element | null} The QR scanner component or null during initial mounting
 *
 * @example
 * ```tsx
 * <QRScanner
 *   onRead={(data) => {
 *     console.log('Scanned QR code:', data);
 *     // Handle the scanned QR code data
 *   }}
 *   context="wallet_connect"
 * />
 * ```
 */
export const QRScanner: React.FC<QRScannerProps> = ({
  onRead,
  context = QRCodeSource.WALLET_CONNECT,
  title,
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const [hasMounted, setHasMounted] = useState(false);
  const [processedCodes, setProcessedCodes] = useState<Set<string>>(new Set());
  const lastScanTimeRef = useRef<number>(0);

  const handleCodeScanned = useCallback(
    (codes: Code[]) => {
      if (codes.length === 0 || !codes[0].value) {
        return;
      }

      const codeValue = codes[0].value;
      const now = Date.now();

      // Check if we've already processed this code
      if (processedCodes.has(codeValue)) {
        return;
      }

      // Check if we're scanning too frequently (debounce)
      if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
        return;
      }

      // Update last scan time and add to processed codes
      lastScanTimeRef.current = now;
      setProcessedCodes((prev) => new Set([...prev, codeValue]));

      // Track analytics and call onRead
      analytics.trackQRScanSuccess(context);
      onRead(codeValue);
    },
    [processedCodes, context, onRead],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: handleCodeScanned,
  });

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    setTimeout(() => {
      setHasMounted(true);
    }, MOUNTING_DELAY);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    // Track error if permissions denied or camera unavailable (mobile-specific feature)
    if (device == null || !hasPermission) {
      const error = device == null ? "camera_unavailable" : "permission_denied";
      analytics.trackQRScanError(error, context);
    }
  }, [hasMounted, device, hasPermission, context]);

  if (!hasMounted && device == null) {
    return null;
  }

  if (device == null || !hasPermission) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text sm secondary textAlign="center">
          {t("qrScanner.cameraNotAvailable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* SVG Mask overlay with center cutout */}
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="cutout">
              <Rect width="100%" height="100%" fill="white" />
              <Rect
                y={CUTOUT_TOP_OFFSET}
                x="50%"
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
            zIndex: ABOVE_OVERLAY_Z_INDEX,
            top: CUTOUT_TOP_OFFSET,
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

        {/* Scan instruction text */}
        <View
          style={{
            position: "absolute",
            zIndex: ABOVE_OVERLAY_Z_INDEX,
            top: CUTOUT_TOP_OFFSET,
            width: "100%",
            transform: [
              {
                translateY:
                  -CUTOUT_SIZE / 2 + CUTOUT_SIZE + CUTOUT_TEXT_TOP_OFFSET,
              },
            ],
          }}
        >
          <Text md primary medium textAlign="center">
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
};
