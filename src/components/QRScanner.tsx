import React, { useState, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from "react-native-vision-camera";
import Icon from "components/sds/Icon";

interface QRScannerProps {
  onRead: (data: string) => void;
  onClose: () => void;
}

export const QRScanner = ({ onRead, onClose }: QRScannerProps) => {
  const [hasPermission, setHasPermission] = useState(false);
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
    const requestCameraPermission = async () => {
      const permission = await Camera.requestCameraPermission();
      setHasPermission(permission === "granted");
    };

    requestCameraPermission();
  }, []);

  if (device == null || !hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Camera not available or not permitted
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        codeScanner={codeScanner}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
      />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Icon.X color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  closeButton: {
    padding: 8,
  },
  errorText: {
    color: "white",
    textAlign: "center",
    marginTop: 20,
  },
}); 