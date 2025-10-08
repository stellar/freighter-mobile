import { BackendEnvironment, useBackendConfigStore } from "ducks/backendConfig";
import { isDev, isProd } from "helpers/isEnv";
import Config from "react-native-config";

type EnvConfigType = {
  AMPLITUDE_API_KEY: string;
  AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY: string;

  FREIGHTER_BACKEND_V1_URL: string;
  FREIGHTER_BACKEND_V2_URL: string;

  WALLET_KIT_PROJECT_ID: string;
  WALLET_KIT_MT_NAME: string;
  WALLET_KIT_MT_DESCRIPTION: string;
  WALLET_KIT_MT_URL: string;
  WALLET_KIT_MT_ICON: string;
  WALLET_KIT_MT_REDIRECT_NATIVE: string;

  SENTRY_DSN: string;

  ANDROID_DEBUG_KEYSTORE_PASSWORD: string;
  ANDROID_DEBUG_KEYSTORE_ALIAS: string;
  ANDROID_DEV_KEYSTORE_PASSWORD: string;
  ANDROID_DEV_KEYSTORE_ALIAS: string;
  ANDROID_PROD_KEYSTORE_PASSWORD: string;
  ANDROID_PROD_KEYSTORE_ALIAS: string;
};

/**
 * Get the backend URL based on the selected environment
 */
const getBackendV1Url = (environment?: BackendEnvironment): string => {
  switch (environment) {
    case BackendEnvironment.PROD:
      return Config.FREIGHTER_BACKEND_V1_PROD_URL;
    case BackendEnvironment.STG:
      return Config.FREIGHTER_BACKEND_V1_STG_URL;
    case BackendEnvironment.DEV:
      return Config.FREIGHTER_BACKEND_V1_DEV_URL;
    default:
      return Config.FREIGHTER_BACKEND_V1_DEV_URL;
  }
};

/**
 * Get the backend V2 URL based on the selected environment
 */
const getBackendV2Url = (environment?: BackendEnvironment): string => {
  switch (environment) {
    case BackendEnvironment.PROD:
      return Config.FREIGHTER_BACKEND_V2_PROD_URL;
    case BackendEnvironment.STG:
      return Config.FREIGHTER_BACKEND_V2_STG_URL;
    case BackendEnvironment.DEV:
      return Config.FREIGHTER_BACKEND_V2_DEV_URL;
    default:
      return Config.FREIGHTER_BACKEND_V2_DEV_URL;
  }
};

/**
 * Get environment-specific configuration based on bundle ID
 */
const getEnvConfig = (): EnvConfigType => {
  // For dev builds, get the selected backend environment from the store
  const backendConfig = isDev ? useBackendConfigStore.getState() : null;

  return {
    // Let's avoid sending events to Amplitude while developing locally
    AMPLITUDE_API_KEY: __DEV__ ? "" : Config.AMPLITUDE_API_KEY,
    AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY:
      Config.AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY,

    SENTRY_DSN: Config.SENTRY_DSN,

    // For prod builds, always use production backend
    // For dev builds, use the user-selected backend environment
    FREIGHTER_BACKEND_V1_URL: getBackendV1Url(
      isProd ? BackendEnvironment.PROD : backendConfig?.backendV1Environment,
    ),
    FREIGHTER_BACKEND_V2_URL: getBackendV2Url(
      isProd ? BackendEnvironment.PROD : backendConfig?.backendV2Environment,
    ),

    WALLET_KIT_PROJECT_ID: Config.WALLET_KIT_PROJECT_ID,
    WALLET_KIT_MT_URL: Config.WALLET_KIT_MT_URL,
    WALLET_KIT_MT_ICON: Config.WALLET_KIT_MT_ICON,

    // Get wallet kit metadata based on bundle ID
    WALLET_KIT_MT_NAME: isProd
      ? Config.WALLET_KIT_MT_NAME_PROD
      : Config.WALLET_KIT_MT_NAME_DEV,
    WALLET_KIT_MT_DESCRIPTION: isProd
      ? Config.WALLET_KIT_MT_DESCRIPTION_PROD
      : Config.WALLET_KIT_MT_DESCRIPTION_DEV,
    WALLET_KIT_MT_REDIRECT_NATIVE: isProd
      ? Config.WALLET_KIT_MT_REDIRECT_NATIVE_PROD
      : Config.WALLET_KIT_MT_REDIRECT_NATIVE_DEV,

    ANDROID_DEBUG_KEYSTORE_PASSWORD: Config.ANDROID_DEBUG_KEYSTORE_PASSWORD,
    ANDROID_DEBUG_KEYSTORE_ALIAS: Config.ANDROID_DEBUG_KEYSTORE_ALIAS,
    ANDROID_DEV_KEYSTORE_PASSWORD: Config.ANDROID_DEV_KEYSTORE_PASSWORD,
    ANDROID_DEV_KEYSTORE_ALIAS: Config.ANDROID_DEV_KEYSTORE_ALIAS,
    ANDROID_PROD_KEYSTORE_PASSWORD: Config.ANDROID_PROD_KEYSTORE_PASSWORD,
    ANDROID_PROD_KEYSTORE_ALIAS: Config.ANDROID_PROD_KEYSTORE_ALIAS,
  };
};

export const EnvConfig = getEnvConfig();
