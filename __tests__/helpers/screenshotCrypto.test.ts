import { decode, encode } from "@stablelib/base64";
import { BROWSER_CONSTANTS } from "config/constants";

// jest.setup.js mocks @stablelib/base64 with a fixed stub (decode → [1,2,3])
// which is fine for most suites but breaks the byte-exact packing/round-trip
// assertions here. Override with a real, standard-base64 implementation so
// encode/decode round-trip the same way the production module does.
jest.mock("@stablelib/base64", () => ({
  encode: (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64"),
  decode: (str: string): Uint8Array =>
    new Uint8Array(Buffer.from(str, "base64")),
}));
import {
  getOrCreateScreenshotDek,
  encryptScreenshot,
  decryptScreenshot,
  clearScreenshotDek,
  resetScreenshotDek,
} from "helpers/screenshotCrypto";
import * as Keychain from "react-native-keychain";
import QuickCrypto from "react-native-quick-crypto";

// react-native-keychain and react-native-quick-crypto are mocked globally in
// jest.setup.js. Native AES-GCM isn't available in Node, so subtle.encrypt /
// decrypt return fixed buffers — these tests validate the DEK lifecycle and the
// ciphertext packing/version/length logic, not the cipher primitive itself.
const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;
const mockSubtle = QuickCrypto.subtle as jest.Mocked<typeof QuickCrypto.subtle>;
const mockGetRandomValues = QuickCrypto.getRandomValues as jest.Mock;

const VERSION_BYTE = 0x01;
const IV_LENGTH = 12;

describe("screenshotCrypto", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Restore default mock behaviors cleared by clearAllMocks.
    mockGetRandomValues.mockImplementation((arr) => arr);
    mockSubtle.importKey.mockResolvedValue({ type: "secret" } as never);
    mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    mockSubtle.decrypt.mockResolvedValue(new ArrayBuffer(32));
    (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue(null);
    (mockKeychain.setGenericPassword as jest.Mock).mockResolvedValue(undefined);
    (mockKeychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);
    // Clear the module-level memoized DEK promise between tests.
    await clearScreenshotDek();
    jest.clearAllMocks();
  });

  describe("getOrCreateScreenshotDek", () => {
    it("generates and persists a new DEK when none is stored", async () => {
      (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue(null);

      await getOrCreateScreenshotDek();

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledTimes(1);
      const [, , options] = (mockKeychain.setGenericPassword as jest.Mock).mock
        .calls[0];
      expect(options.service).toBe(BROWSER_CONSTANTS.SCREENSHOT_DEK_SERVICE);
      // Non-biometric so thumbnails render without a prompt.
      expect(options.accessControl).toBeUndefined();
      expect(mockSubtle.importKey).toHaveBeenCalledTimes(1);
    });

    it("loads the existing DEK from Keychain without regenerating", async () => {
      const storedBytes = new Uint8Array(32).fill(7);
      (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue({
        password: encode(storedBytes),
      });

      await getOrCreateScreenshotDek();

      expect(mockKeychain.setGenericPassword).not.toHaveBeenCalled();
      expect(mockSubtle.importKey).toHaveBeenCalledTimes(1);
      const importedBytes = (mockSubtle.importKey as jest.Mock).mock
        .calls[0][1] as Uint8Array;
      expect(Array.from(importedBytes)).toEqual(Array.from(storedBytes));
    });

    it("memoizes the DEK so concurrent callers share one Keychain read", async () => {
      (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue(null);

      const [a, b] = await Promise.all([
        getOrCreateScreenshotDek(),
        getOrCreateScreenshotDek(),
      ]);

      // Both callers resolve to the same key, and only one read/generate ran —
      // this is what prevents two different DEKs racing on first use.
      expect(a).toBe(b);
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(mockKeychain.setGenericPassword).toHaveBeenCalledTimes(1);
    });

    it("does not generate a new key when the Keychain read fails", async () => {
      (mockKeychain.getGenericPassword as jest.Mock).mockRejectedValueOnce(
        new Error("Keychain unavailable"),
      );

      await expect(getOrCreateScreenshotDek()).rejects.toThrow(
        "Keychain unavailable",
      );
      // Rotating the DEK on a transient read error would orphan every
      // existing screenshot — generation must NOT happen here.
      expect(mockKeychain.setGenericPassword).not.toHaveBeenCalled();
    });

    it("does not cache failures — the next caller retries", async () => {
      (mockKeychain.getGenericPassword as jest.Mock)
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce(null);

      await expect(getOrCreateScreenshotDek()).rejects.toThrow("transient");
      await expect(getOrCreateScreenshotDek()).resolves.toBeDefined();
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledTimes(2);
    });
  });

  describe("encryptScreenshot", () => {
    it("packs [version | IV | ciphertext] and strips the data-uri prefix", async () => {
      const result = await encryptScreenshot("data:image/jpeg;base64,AAAA");

      const packed = decode(result);
      expect(packed[0]).toBe(VERSION_BYTE);
      // 1 version byte + 12-byte IV + 32-byte mocked ciphertext.
      expect(packed.length).toBe(1 + IV_LENGTH + 32);

      // Only the base64 payload after the comma is encrypted, not the prefix.
      const encryptedBytes = (mockSubtle.encrypt as jest.Mock).mock
        .calls[0][2] as Uint8Array;
      expect(Array.from(encryptedBytes)).toEqual(Array.from(decode("AAAA")));
    });

    it("accepts a bare base64 string with no data-uri prefix", async () => {
      const result = await encryptScreenshot("AAAA");

      const encryptedBytes = (mockSubtle.encrypt as jest.Mock).mock
        .calls[0][2] as Uint8Array;
      expect(Array.from(encryptedBytes)).toEqual(Array.from(decode("AAAA")));
      expect(decode(result)[0]).toBe(VERSION_BYTE);
    });
  });

  describe("decryptScreenshot", () => {
    const buildPacked = (
      version: number,
      ciphertextLength: number,
    ): string => {
      const packed = new Uint8Array(1 + IV_LENGTH + ciphertextLength);
      packed[0] = version;
      return encode(packed);
    };

    it("returns a jpeg data URI for a valid payload", async () => {
      const result = await decryptScreenshot(buildPacked(VERSION_BYTE, 32));

      expect(result.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(mockSubtle.decrypt).toHaveBeenCalledTimes(1);
    });

    it("throws on an unknown version byte", async () => {
      await expect(decryptScreenshot(buildPacked(0x99, 32))).rejects.toThrow(
        "Unknown screenshot encryption version",
      );
    });

    it("throws a clear error on a truncated/empty payload", async () => {
      // Shorter than VERSION(1) + IV(12) + tag(16): must fail before reading
      // the version byte rather than producing a confusing downstream error.
      await expect(decryptScreenshot(encode(new Uint8Array(0)))).rejects.toThrow(
        "too short",
      );
      await expect(
        decryptScreenshot(buildPacked(VERSION_BYTE, 4)),
      ).rejects.toThrow("too short");
      expect(mockSubtle.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("clearScreenshotDek", () => {
    it("removes the Keychain entry and clears the in-memory cache", async () => {
      (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue(null);
      await getOrCreateScreenshotDek();
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledTimes(1);

      await clearScreenshotDek();
      expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
        service: BROWSER_CONSTANTS.SCREENSHOT_DEK_SERVICE,
      });

      // Cache cleared: the next call reads Keychain again instead of returning
      // a stale key.
      await getOrCreateScreenshotDek();
      expect(mockKeychain.getGenericPassword).toHaveBeenCalledTimes(2);
    });
  });

  describe("resetScreenshotDek", () => {
    it("clears the existing entry then generates a fresh DEK", async () => {
      (mockKeychain.getGenericPassword as jest.Mock).mockResolvedValue(null);

      await resetScreenshotDek();

      expect(mockKeychain.resetGenericPassword).toHaveBeenCalled();
      expect(mockKeychain.setGenericPassword).toHaveBeenCalledTimes(1);
    });
  });
});
