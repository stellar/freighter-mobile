import { logger } from "config/logger";
import { asyncStorage } from "services/storage/asyncStorage";

/*
 * NOTE: The contents of this file should only be used for the "Freighter Dev" builds.
 * It should never be used in the "Freighter" production builds.
 */

/**
 * Enum representing the available backend environments for Dev builds.
 *
 * @enum {string}
 * @property {string} PROD - Production environment.
 * @property {string} STG - Staging environment.
 * @property {string} DEV - Development environment.
 */
export enum DevBackendEnvironment {
  PROD = "PROD",
  STG = "STG",
  DEV = "DEV",
}

/**
 * Storage keys for backend environment configuration.
 *
 * These keys are used to store the selected backend environment (V1 and V2) in AsyncStorage.
 *
 * Note: These keys are intentionally not included in the main STORAGE_KEYS enum in constants.ts
 * because changing or clearing the backend environment should not be done without explicit user consent.
 * This separation helps prevent accidental removal or modification of backend environment settings
 * during standard storage clearing operations (such as logout).
 *
 * @property {string} BACKEND_V1_ENVIRONMENT - Key for storing the selected Backend V1 environment.
 * @property {string} BACKEND_V2_ENVIRONMENT - Key for storing the selected Backend V2 environment.
 */
const STORAGE_KEYS = {
  BACKEND_V1_ENVIRONMENT: "@backend-config:v1-environment",
  BACKEND_V2_ENVIRONMENT: "@backend-config:v2-environment",
} as const;

// NOTE: We should switch to STG for V1 as well as soon as it's publicly available.
const DEFAULT_BACKEND_V1_ENVIRONMENT = DevBackendEnvironment.PROD;
const DEFAULT_BACKEND_V2_ENVIRONMENT = DevBackendEnvironment.STG;

/**
 * Get the selected Backend V1 environment from AsyncStorage
 * Returns PROD as default if nothing is stored
 */
export const getDevBackendV1Environment =
  async (): Promise<DevBackendEnvironment> => {
    try {
      const value = await asyncStorage.getItem(
        STORAGE_KEYS.BACKEND_V1_ENVIRONMENT,
      );
      return (value as DevBackendEnvironment) || DEFAULT_BACKEND_V1_ENVIRONMENT;
    } catch (error) {
      logger.error(
        "backendConfig",
        "Failed to get Backend V1 environment",
        error,
      );
      return DEFAULT_BACKEND_V1_ENVIRONMENT;
    }
  };

/**
 * Get the selected Backend V2 environment from AsyncStorage
 * Returns PROD as default if nothing is stored
 */
export const getDevBackendV2Environment =
  async (): Promise<DevBackendEnvironment> => {
    try {
      const value = await asyncStorage.getItem(
        STORAGE_KEYS.BACKEND_V2_ENVIRONMENT,
      );
      return (value as DevBackendEnvironment) || DEFAULT_BACKEND_V2_ENVIRONMENT;
    } catch (error) {
      logger.error(
        "backendConfig",
        "Failed to get Backend V2 environment",
        error,
      );
      return DEFAULT_BACKEND_V2_ENVIRONMENT;
    }
  };

/**
 * Set the Backend V1 environment in AsyncStorage
 */
export const setDevBackendV1Environment = async (
  environment: DevBackendEnvironment,
): Promise<void> => {
  try {
    await asyncStorage.setItem(
      STORAGE_KEYS.BACKEND_V1_ENVIRONMENT,
      environment,
    );
  } catch (error) {
    logger.error(
      "backendConfig",
      "Failed to set Backend V1 environment",
      error,
    );
  }
};

/**
 * Set the Backend V2 environment in AsyncStorage
 */
export const setDevBackendV2Environment = async (
  environment: DevBackendEnvironment,
): Promise<void> => {
  try {
    await asyncStorage.setItem(
      STORAGE_KEYS.BACKEND_V2_ENVIRONMENT,
      environment,
    );
  } catch (error) {
    logger.error(
      "backendConfig",
      "Failed to set Backend V2 environment",
      error,
    );
  }
};
