import { getVersion, getBuildNumber } from "react-native-device-info";

export const getAppVersion = (): string => getVersion();

export const getAppVersionAndBuildNumber = (): string => {
  const version = getAppVersion();
  const buildNumber = getBuildNumber();

  return `v${version} (${buildNumber})`;
};
