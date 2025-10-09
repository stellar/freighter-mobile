/**
 * Tests for envConfig module
 *
 * Note: These tests verify that the envConfig module is properly mocked in jest.setup.js
 * and that the mocked values are accessible in tests. The actual async initialization
 * logic is tested through integration tests and manual QA.
 */
import { EnvConfig, BackendEnvConfig } from "config/envConfig";

describe("envConfig", () => {
  describe("EnvConfig", () => {
    it("should export synchronous configuration object", () => {
      expect(EnvConfig).toBeDefined();
      expect(typeof EnvConfig).toBe("object");
    });

    it("should have AMPLITUDE_API_KEY property", () => {
      expect(EnvConfig).toHaveProperty("AMPLITUDE_API_KEY");
      expect(typeof EnvConfig.AMPLITUDE_API_KEY).toBe("string");
    });

    it("should have AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY property", () => {
      expect(EnvConfig).toHaveProperty("AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY");
      expect(typeof EnvConfig.AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY).toBe(
        "string",
      );
    });

    it("should have SENTRY_DSN property", () => {
      expect(EnvConfig).toHaveProperty("SENTRY_DSN");
      expect(typeof EnvConfig.SENTRY_DSN).toBe("string");
    });

    it("should have WALLET_KIT configuration properties", () => {
      expect(EnvConfig).toHaveProperty("WALLET_KIT_PROJECT_ID");
      expect(EnvConfig).toHaveProperty("WALLET_KIT_MT_NAME");
      expect(EnvConfig).toHaveProperty("WALLET_KIT_MT_DESCRIPTION");
      expect(EnvConfig).toHaveProperty("WALLET_KIT_MT_URL");
      expect(EnvConfig).toHaveProperty("WALLET_KIT_MT_ICON");
      expect(EnvConfig).toHaveProperty("WALLET_KIT_MT_REDIRECT_NATIVE");

      expect(typeof EnvConfig.WALLET_KIT_PROJECT_ID).toBe("string");
      expect(typeof EnvConfig.WALLET_KIT_MT_NAME).toBe("string");
      expect(typeof EnvConfig.WALLET_KIT_MT_DESCRIPTION).toBe("string");
    });

    it("should have Android keystore configuration properties", () => {
      expect(EnvConfig).toHaveProperty("ANDROID_DEBUG_KEYSTORE_PASSWORD");
      expect(EnvConfig).toHaveProperty("ANDROID_DEBUG_KEYSTORE_ALIAS");
      expect(EnvConfig).toHaveProperty("ANDROID_DEV_KEYSTORE_PASSWORD");
      expect(EnvConfig).toHaveProperty("ANDROID_DEV_KEYSTORE_ALIAS");
      expect(EnvConfig).toHaveProperty("ANDROID_PROD_KEYSTORE_PASSWORD");
      expect(EnvConfig).toHaveProperty("ANDROID_PROD_KEYSTORE_ALIAS");

      expect(typeof EnvConfig.ANDROID_DEBUG_KEYSTORE_PASSWORD).toBe("string");
      expect(typeof EnvConfig.ANDROID_DEBUG_KEYSTORE_ALIAS).toBe("string");
    });
  });

  describe("BackendEnvConfig", () => {
    it("should export backend configuration object", () => {
      expect(BackendEnvConfig).toBeDefined();
      expect(typeof BackendEnvConfig).toBe("object");
    });

    it("should have FREIGHTER_BACKEND_V1_URL property", () => {
      expect(BackendEnvConfig).toHaveProperty("FREIGHTER_BACKEND_V1_URL");
      expect(typeof BackendEnvConfig.FREIGHTER_BACKEND_V1_URL).toBe("string");
      expect(BackendEnvConfig.FREIGHTER_BACKEND_V1_URL).toContain("https://");
      expect(BackendEnvConfig.FREIGHTER_BACKEND_V1_URL).toContain("/api/v1");
    });

    it("should have FREIGHTER_BACKEND_V2_URL property", () => {
      expect(BackendEnvConfig).toHaveProperty("FREIGHTER_BACKEND_V2_URL");
      expect(typeof BackendEnvConfig.FREIGHTER_BACKEND_V2_URL).toBe("string");
      expect(BackendEnvConfig.FREIGHTER_BACKEND_V2_URL).toContain("https://");
      expect(BackendEnvConfig.FREIGHTER_BACKEND_V2_URL).toContain("/api/v1");
    });

    it("should provide valid backend URLs for testing", () => {
      // In tests, the mock should provide valid URL strings
      expect(
        BackendEnvConfig.FREIGHTER_BACKEND_V1_URL.startsWith("https://"),
      ).toBe(true);
      expect(
        BackendEnvConfig.FREIGHTER_BACKEND_V2_URL.startsWith("https://"),
      ).toBe(true);
    });
  });

  describe("Module exports", () => {
    it("should export all required configuration objects", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const envConfigModule = require("config/envConfig");

      expect(envConfigModule).toHaveProperty("EnvConfig");
      expect(envConfigModule).toHaveProperty("BackendEnvConfig");
    });

    it("should have EnvConfig as a non-null object", () => {
      expect(EnvConfig).not.toBeNull();
      expect(EnvConfig).not.toBeUndefined();
      expect(Object.keys(EnvConfig).length).toBeGreaterThan(0);
    });

    it("should have BackendEnvConfig as a non-null object", () => {
      expect(BackendEnvConfig).not.toBeNull();
      expect(BackendEnvConfig).not.toBeUndefined();
      expect(Object.keys(BackendEnvConfig).length).toBe(2);
    });
  });
});
