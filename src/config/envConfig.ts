import {
  DevBackendEnvironment,
  getDevBackendV1Environment,
  getDevBackendV2Environment,
} from "config/devBackendConfig";
import { isE2ETest, isProd } from "helpers/isEnv";
import Config from "react-native-config";

/**
 * Represents the environment-specific configuration variables.
 *
 * @typedef {Object} EnvConfigType
 * @property {string} AMPLITUDE_API_KEY - Amplitude API key for analytics.
 * @property {string} AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY - Amplitude Experiment deployment key for feature flags..
 * @property {string} WALLET_KIT_PROJECT_ID - Wallet Kit project identifier.
 * @property {string} WALLET_KIT_MT_NAME - Wallet Kit metadata: name.
 * @property {string} WALLET_KIT_MT_DESCRIPTION - Wallet Kit metadata: description.
 * @property {string} WALLET_KIT_MT_URL - Wallet Kit metadata: URL.
 * @property {string} WALLET_KIT_MT_ICON - Wallet Kit metadata: icon URL.
 * @property {string} WALLET_KIT_MT_REDIRECT_NATIVE - Wallet Kit metadata: native redirect URI.
 * @property {string} SENTRY_DSN - Sentry Data Source Name for error tracking.
 * @property {string} ANDROID_DEBUG_KEYSTORE_PASSWORD - Android debug keystore password.
 * @property {string} ANDROID_DEBUG_KEYSTORE_ALIAS - Android debug keystore alias.
 * @property {string} ANDROID_DEV_KEYSTORE_PASSWORD - Android development keystore password.
 * @property {string} ANDROID_DEV_KEYSTORE_ALIAS - Android development keystore alias.
 * @property {string} ANDROID_PROD_KEYSTORE_PASSWORD - Android production keystore password.
 * @property {string} ANDROID_PROD_KEYSTORE_ALIAS - Android production keystore alias.
 */
type EnvConfigType = {
  AMPLITUDE_API_KEY: string;
  AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY: string;

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

  MP_COLLECTIONS_ADDRESSES: string[];
};

/**
 * Represents the backend environment configuration.
 *
 * @typedef {Object} BackendEnvConfigType
 * @property {string} FREIGHTER_BACKEND_V1_URL - URL for Freighter Backend V1.
 * @property {string} FREIGHTER_BACKEND_V2_URL - URL for Freighter Backend V2.
 */
type BackendEnvConfigType = {
  FREIGHTER_BACKEND_V1_URL: string;
  FREIGHTER_BACKEND_V2_URL: string;
};

/**
 * Get wallet kit configuration based on environment
 */
const getWalletKitConfig = (isProduction: boolean) => {
  const prodConfig = {
    WALLET_KIT_PROJECT_ID: Config.WALLET_KIT_PROJECT_ID_PROD,
    WALLET_KIT_MT_URL: Config.WALLET_KIT_MT_URL_PROD,
    WALLET_KIT_MT_ICON: Config.WALLET_KIT_MT_ICON_PROD,
    WALLET_KIT_MT_NAME: Config.WALLET_KIT_MT_NAME_PROD,
    WALLET_KIT_MT_DESCRIPTION: Config.WALLET_KIT_MT_DESCRIPTION_PROD,
    WALLET_KIT_MT_REDIRECT_NATIVE: Config.WALLET_KIT_MT_REDIRECT_NATIVE_PROD,
  };

  const devConfig = {
    WALLET_KIT_PROJECT_ID: Config.WALLET_KIT_PROJECT_ID_DEV,
    WALLET_KIT_MT_URL: Config.WALLET_KIT_MT_URL_DEV,
    WALLET_KIT_MT_ICON: Config.WALLET_KIT_MT_ICON_DEV,
    WALLET_KIT_MT_NAME: Config.WALLET_KIT_MT_NAME_DEV,
    WALLET_KIT_MT_DESCRIPTION: Config.WALLET_KIT_MT_DESCRIPTION_DEV,
    WALLET_KIT_MT_REDIRECT_NATIVE: Config.WALLET_KIT_MT_REDIRECT_NATIVE_DEV,
  };

  return isProduction ? prodConfig : devConfig;
};

/**
 * Get environment-specific configuration based on bundle ID
 */
const getEnvConfig = (): EnvConfigType => ({
  // Let's avoid sending events to Amplitude while developing locally or during e2e tests
  AMPLITUDE_API_KEY: __DEV__ || isE2ETest ? "" : Config.AMPLITUDE_API_KEY,
  AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY:
    Config.AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY,

  SENTRY_DSN: Config.SENTRY_DSN,

  ...getWalletKitConfig(isProd),

  ANDROID_DEBUG_KEYSTORE_PASSWORD: Config.ANDROID_DEBUG_KEYSTORE_PASSWORD,
  ANDROID_DEBUG_KEYSTORE_ALIAS: Config.ANDROID_DEBUG_KEYSTORE_ALIAS,
  ANDROID_DEV_KEYSTORE_PASSWORD: Config.ANDROID_DEV_KEYSTORE_PASSWORD,
  ANDROID_DEV_KEYSTORE_ALIAS: Config.ANDROID_DEV_KEYSTORE_ALIAS,
  ANDROID_PROD_KEYSTORE_PASSWORD: Config.ANDROID_PROD_KEYSTORE_PASSWORD,
  ANDROID_PROD_KEYSTORE_ALIAS: Config.ANDROID_PROD_KEYSTORE_ALIAS,

  // Parse comma-separated list of collection addresses
  MP_COLLECTIONS_ADDRESSES: Config.MP_COLLECTIONS_ADDRESSES
    ? Config.MP_COLLECTIONS_ADDRESSES.split(",").map((addr) => addr.trim())
    : [],
});

/**
 * Get the backend V1 URL based on the selected environment
 */
const getDevBackendV1Url = (environment?: DevBackendEnvironment): string => {
  switch (environment) {
    case DevBackendEnvironment.PROD:
      return Config.FREIGHTER_BACKEND_V1_PROD_URL;
    case DevBackendEnvironment.STG:
      return Config.FREIGHTER_BACKEND_V1_STG_URL;
    case DevBackendEnvironment.DEV:
      return Config.FREIGHTER_BACKEND_V1_DEV_URL;
    default:
      return Config.FREIGHTER_BACKEND_V1_DEV_URL;
  }
};

/**
 * Get the backend V2 URL based on the selected environment
 */
const getDevBackendV2Url = (environment?: DevBackendEnvironment): string => {
  switch (environment) {
    case DevBackendEnvironment.PROD:
      return Config.FREIGHTER_BACKEND_V2_PROD_URL;
    case DevBackendEnvironment.STG:
      return Config.FREIGHTER_BACKEND_V2_STG_URL;
    case DevBackendEnvironment.DEV:
      return Config.FREIGHTER_BACKEND_V2_DEV_URL;
    default:
      return Config.FREIGHTER_BACKEND_V2_DEV_URL;
  }
};

/**
 * Get backend environment configuration
 * For dev builds, reads from AsyncStorage (async)
 * For prod builds, returns production URLs immediately
 */
const getBackendEnvConfig = async (): Promise<BackendEnvConfigType> => {
  if (isProd) {
    // For prod builds, always use production backend (synchronous)
    return {
      FREIGHTER_BACKEND_V1_URL: Config.FREIGHTER_BACKEND_V1_PROD_URL,
      FREIGHTER_BACKEND_V2_URL: Config.FREIGHTER_BACKEND_V2_PROD_URL,
    };
  }

  // For dev builds, get the selected backend environment from AsyncStorage
  const devBackendV1Env = await getDevBackendV1Environment();
  const devBackendV2Env = await getDevBackendV2Environment();

  return {
    FREIGHTER_BACKEND_V1_URL: getDevBackendV1Url(devBackendV1Env),
    FREIGHTER_BACKEND_V2_URL: getDevBackendV2Url(devBackendV2Env),
  };
};

/**
 * BackendEnvConfig is an asynchronous environment configuration object.
 *
 * In the Freighter Dev app, users can change the backend environment through settings,
 * so this value must be awaited before use. In the Freighter production build, it behaves
 * like a synchronous call, as the backend environment is fixed.
 */
// eslint-disable-next-line import/no-mutable-exports
export let BackendEnvConfig: BackendEnvConfigType;
getBackendEnvConfig().then((config) => {
  BackendEnvConfig = config;
});

/**
 * Synchronous environment configuration object.
 *
 * Note: This is initialized using getEnvConfig(), which provides the environment configuration
 * for the current build (production or development). For asynchronous backend environment config,
 * use BackendEnvConfig instead.
 */
export const EnvConfig = getEnvConfig();
