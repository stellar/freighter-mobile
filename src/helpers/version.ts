import packageJson from "package.json";

export const getAppVersion = (): string => packageJson.version;
