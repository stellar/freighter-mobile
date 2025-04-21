import { getVersion, getBuildNumber } from "react-native-device-info";

export const getAppVersion = (): string => {
  const version = getVersion();
  const buildNumber = getBuildNumber();

  return `v${version} (${buildNumber})`;
};
