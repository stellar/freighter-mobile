import {
  AUTO_LOCK_TIMER,
  DEFAULT_AUTO_LOCK_TIMER,
  HASH_KEY_EXPIRATION_MS,
  NEVER_EXPIRE_HASH_KEY_MS,
  SENSITIVE_STORAGE_KEYS,
} from "config/constants";
import {
  applyAutoLockTimerToHashKey,
  clearBackgroundedAt,
  getAutoLockTimer,
  getBackgroundedAt,
  getHashKeyExpirationMs,
  persistAutoLockTimer,
  recordBackgroundedAt,
} from "services/autoLock";
import { getHashKey } from "services/storage/helpers";
import { secureDataStorage } from "services/storage/storageFactory";

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  secureDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("services/storage/helpers", () => ({
  getHashKey: jest.fn(),
}));

describe("autoLock service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAutoLockTimer", () => {
    it("returns the persisted timer when it is a valid option", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue(
        AUTO_LOCK_TIMER.FIFTEEN_MINUTES,
      );

      const timer = await getAutoLockTimer();

      expect(secureDataStorage.getItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING,
      );
      expect(timer).toBe(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
    });

    it("falls back to the default when no timer is persisted", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue(null);

      const timer = await getAutoLockTimer();

      expect(timer).toBe(DEFAULT_AUTO_LOCK_TIMER);
    });

    it("falls back to the default when the persisted value is invalid", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue("not-a-timer");

      const timer = await getAutoLockTimer();

      expect(timer).toBe(DEFAULT_AUTO_LOCK_TIMER);
    });
  });

  describe("persistAutoLockTimer", () => {
    it("writes the timer to the secure-storage mirror", async () => {
      await persistAutoLockTimer(AUTO_LOCK_TIMER.ONE_HOUR);

      expect(secureDataStorage.setItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_TIMER_SETTING,
        AUTO_LOCK_TIMER.ONE_HOUR,
      );
    });
  });

  describe("getHashKeyExpirationMs", () => {
    it("returns the default hash key TTL for regular timers", () => {
      expect(getHashKeyExpirationMs(AUTO_LOCK_TIMER.ONE_MINUTE)).toBe(
        HASH_KEY_EXPIRATION_MS,
      );
      expect(getHashKeyExpirationMs(AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS)).toBe(
        HASH_KEY_EXPIRATION_MS,
      );
    });

    it("returns the never-expire TTL for NONE", () => {
      expect(getHashKeyExpirationMs(AUTO_LOCK_TIMER.NONE)).toBe(
        NEVER_EXPIRE_HASH_KEY_MS,
      );
    });
  });

  describe("applyAutoLockTimerToHashKey", () => {
    it("re-anchors the stored hash key expiration", async () => {
      const mockHashKey = {
        hashKey: "mock-hash-key",
        salt: "mock-salt",
        expiresAt: Date.now(),
      };
      (getHashKey as jest.Mock).mockResolvedValue(mockHashKey);

      const before = Date.now();
      await applyAutoLockTimerToHashKey(AUTO_LOCK_TIMER.NONE);

      expect(secureDataStorage.setItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        expect.any(String),
      );

      const [, storedValue] = (secureDataStorage.setItem as jest.Mock).mock
        .calls[0];
      const storedHashKey = JSON.parse(storedValue);
      expect(storedHashKey.hashKey).toBe(mockHashKey.hashKey);
      expect(storedHashKey.salt).toBe(mockHashKey.salt);
      expect(storedHashKey.expiresAt).toBeGreaterThanOrEqual(
        before + NEVER_EXPIRE_HASH_KEY_MS,
      );
    });

    it("is a no-op when no hash key is stored", async () => {
      (getHashKey as jest.Mock).mockResolvedValue(null);

      await applyAutoLockTimerToHashKey(AUTO_LOCK_TIMER.ONE_HOUR);

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("backgrounded-at timestamp", () => {
    it("records the current time when the app backgrounds", async () => {
      const before = Date.now();
      await recordBackgroundedAt();

      expect(secureDataStorage.setItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
        expect.any(String),
      );

      const [, storedValue] = (secureDataStorage.setItem as jest.Mock).mock
        .calls[0];
      expect(Number(storedValue)).toBeGreaterThanOrEqual(before);
    });

    it("returns the persisted timestamp as a number", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue("1234567890");

      const backgroundedAt = await getBackgroundedAt();

      expect(secureDataStorage.getItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
      );
      expect(backgroundedAt).toBe(1234567890);
    });

    it("returns null when no timestamp is persisted", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue(null);

      const backgroundedAt = await getBackgroundedAt();

      expect(backgroundedAt).toBeNull();
    });

    it("cleans up and returns null for a corrupt timestamp", async () => {
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue(
        "not-a-number",
      );

      const backgroundedAt = await getBackgroundedAt();

      expect(backgroundedAt).toBeNull();
      expect(secureDataStorage.remove).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
      );
    });

    it("forces a lock for a future-dated timestamp (clock anomaly)", async () => {
      // A future-dated timestamp means the device clock moved backward; rather
      // than skip the lock, treat it as an epoch-old background so any positive
      // timer elapses and the wallet locks conservatively.
      const oneHourAhead = Date.now() + 3600000;
      (secureDataStorage.getItem as jest.Mock).mockResolvedValue(
        String(oneHourAhead),
      );

      const backgroundedAt = await getBackgroundedAt();

      expect(backgroundedAt).toBe(0);
    });

    it("clears the persisted timestamp", async () => {
      await clearBackgroundedAt();

      expect(secureDataStorage.remove).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.AUTO_LOCK_BACKGROUNDED_AT,
      );
    });
  });
});
