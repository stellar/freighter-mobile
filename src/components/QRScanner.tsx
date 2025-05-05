import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import React, { useEffect } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from "react-native-vision-camera";

type QRScannerProps = {
  onRead: (data: string) => void;
};

const windowWidth = Dimensions.get("window").width;

// TODO: translations
export const QRScanner: React.FC<QRScannerProps> = ({ onRead }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");

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

  if (device == null || !hasPermission) {
    return (
      <View
        className="flex-1 bg-black justify-center items-center"
        style={{ width: windowWidth, marginLeft: -pxValue(DEFAULT_PADDING) }}
      >
        <Text className="text-white text-center mt-5">
          Camera not available or not permitted
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ width: windowWidth, marginLeft: -pxValue(DEFAULT_PADDING) }}
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
