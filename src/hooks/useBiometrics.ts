import { useCallback } from "react";
import ReactNativeBiometrics, { BiometryTypes } from "react-native-biometrics";

export const useBiometrics = () => {
  const isBiometricsAvailable = useCallback(async (): Promise<void> => {
    const rnBiometrics = new ReactNativeBiometrics();
    const result = await rnBiometrics.isSensorAvailable();
    const { available, biometryType } = result;
    if (available && biometryType === BiometryTypes.TouchID) {
      console.log("TouchID is supported");
    } else if (available && biometryType === BiometryTypes.FaceID) {
      console.log("FaceID is supported");
    } else if (available && biometryType === BiometryTypes.Biometrics) {
      console.log("Biometrics is supported");
    } else {
      console.log("Biometrics not supported");
    }
  }, []);
  return {
    isBiometricsAvailable,
  };
};
