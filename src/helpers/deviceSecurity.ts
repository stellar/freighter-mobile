import JailMonkey from "jail-monkey";

export const isDeviceJailbroken = (): boolean => {
  try {
    return JailMonkey.isJailBroken();
  } catch (error) {
    // Fail closed - treat errors as jailbroken device
    return true;
  }
};
