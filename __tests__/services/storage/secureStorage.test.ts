/* eslint-disable @fnando/consistent-import/consistent-import */
import { logger } from "config/logger";
import * as Keychain from "react-native-keychain";
import { createSecureStorage } from "services/storage/secureStorage";

jest.mock("react-native-keychain");
jest.mock("react-native-biometrics", () =>
  jest.fn().mockImplementation(() => ({
    simplePrompt: jest.fn().mockResolvedValue({ success: true }),
  })),
);

const mockedKeychain = Keychain as jest.Mocked<typeof Keychain>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const INTERACTION_ERR = new Error("User interaction is not allowed.");

describe("secureStorage interaction-not-allowed branching", () => {
  const storage = createSecureStorage("test_service");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("read paths (warn for background-restricted reads)", () => {
    it("getItem: demotes errSecInteractionNotAllowed to logger.warn", async () => {
      (mockedKeychain.getGenericPassword as jest.Mock).mockRejectedValue(
        INTERACTION_ERR,
      );

      const result = await storage.getItem("k");

      expect(result).toBe(false);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "secureStorage.getItem",
        expect.stringContaining("Keychain read blocked"),
      );
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("getItem: real failures (not interaction-not-allowed) stay logger.error", async () => {
      const realErr = new Error("Decryption failed: ...");
      (mockedKeychain.getGenericPassword as jest.Mock).mockRejectedValue(
        realErr,
      );

      const result = await storage.getItem("k");

      expect(result).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "secureStorage.getItem",
        expect.stringContaining("Error retrieving"),
        realErr,
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it("checkIfExists: demotes errSecInteractionNotAllowed to logger.warn", async () => {
      (mockedKeychain.hasGenericPassword as jest.Mock).mockRejectedValue(
        INTERACTION_ERR,
      );

      const result = await storage.checkIfExists("k");

      expect(result).toBe(false);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "secureStorage.checkIfExists",
        expect.stringContaining("Keychain check blocked"),
      );
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("getItem: matches interaction-not-allowed when the rejection is a plain object (not an Error instance)", async () => {
      // RN's bridge wraps native rejections in Error instances on the
      // current version, but the predicate intentionally accepts any
      // object with the matching `message` so a future bridge change
      // (or vendor patch) that ships a plain `{ code, message }` shape
      // still routes errSecInteractionNotAllowed to the warn path.
      const plainObjectRejection = {
        code: "-25308",
        message: "User interaction is not allowed.",
      };
      (mockedKeychain.getGenericPassword as jest.Mock).mockRejectedValue(
        plainObjectRejection,
      );

      const result = await storage.getItem("k");

      expect(result).toBe(false);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "secureStorage.getItem",
        expect.stringContaining("Keychain read blocked"),
      );
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("write paths (always logger.error - auth-critical / security-relevant)", () => {
    it("setItem: keeps errSecInteractionNotAllowed as logger.error", async () => {
      (mockedKeychain.setGenericPassword as jest.Mock).mockRejectedValue(
        INTERACTION_ERR,
      );

      await expect(storage.setItem("k", "v")).rejects.toThrow(
        "Failed to store item in keychain",
      );
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "secureStorage.setItem",
        expect.stringContaining("Error storing"),
        INTERACTION_ERR,
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it("remove: keeps errSecInteractionNotAllowed as logger.error", async () => {
      (mockedKeychain.resetGenericPassword as jest.Mock).mockRejectedValue(
        INTERACTION_ERR,
      );

      // remove() doesn't throw (cleanup failures shouldn't block flow)
      await storage.remove("k");

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "secureStorage.remove",
        expect.stringContaining("Error removing"),
        INTERACTION_ERR,
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it("clear: keeps errSecInteractionNotAllowed as logger.error", async () => {
      (
        mockedKeychain.getAllGenericPasswordServices as jest.Mock
      ).mockResolvedValue(["test_service_a"]);
      (mockedKeychain.resetGenericPassword as jest.Mock).mockRejectedValue(
        INTERACTION_ERR,
      );

      // clear() doesn't throw (logout proceeds even on cleanup failure)
      await storage.clear();

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "secureStorage.clear",
        expect.stringContaining("Error clearing"),
        INTERACTION_ERR,
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });
  });
});
