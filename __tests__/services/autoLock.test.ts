import {
  AUTO_LOCK_TIMER,
  DEFAULT_AUTO_LOCK_TIMER,
  HASH_KEY_EXPIRATION_MS,
  HASH_KEY_REFRESH_THROTTLE_MS,
  SENSITIVE_STORAGE_KEYS,
} from "config/constants";
import { HashKey } from "config/types";
import {
  clearBackgroundedAt,
  getAutoLockTimer,
  getBackgroundedAt,
  isHashKeyExpired,
  persistAutoLockTimer,
  recordBackgroundedAt,
  refreshHashKeyExpiration,
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

  describe("isHashKeyExpired", () => {
    const baseKey: HashKey = {
      hashKey: "mock-hash-key",
      salt: "mock-salt",
      expiresAt: Date.now() + 3_600_000,
      generatedAt: Date.now(),
    };

    it("returns false for a valid, unexpired key", () => {
      expect(isHashKeyExpired(baseKey)).toBe(false);
    });

    it("returns true when expiresAt has passed", () => {
      expect(
        isHashKeyExpired({ ...baseKey, expiresAt: Date.now() - 1000 }),
      ).toBe(true);
    });

    it("returns true for a future generatedAt (clock rollback)", () => {
      // expiresAt is still ahead of the rolled-back clock — only the
      // generatedAt guard catches this.
      expect(
        isHashKeyExpired({ ...baseKey, generatedAt: Date.now() + 60_000 }),
      ).toBe(true);
    });

    it("falls back to the plain expiry check for legacy keys without generatedAt", () => {
      const { generatedAt, ...legacyKey } = baseKey;
      expect(isHashKeyExpired(legacyKey)).toBe(false);
      expect(
        isHashKeyExpired({ ...legacyKey, expiresAt: Date.now() - 1000 }),
      ).toBe(true);
    });
  });

  describe("refreshHashKeyExpiration", () => {
    const staleValidKey: HashKey = {
      hashKey: "mock-hash-key",
      salt: "mock-salt",
      // Stale: last anchored beyond the throttle window, but not expired.
      generatedAt: Date.now() - (HASH_KEY_REFRESH_THROTTLE_MS + 60_000),
      expiresAt: Date.now() + 3_600_000,
    };

    it("re-stamps expiresAt and generatedAt for a valid, stale key", async () => {
      // The TOCTOU guard re-reads at write time: storage still holds the
      // exact key the caller validated.
      (getHashKey as jest.Mock).mockResolvedValue(staleValidKey);

      const before = Date.now();
      await refreshHashKeyExpiration(staleValidKey);

      expect(secureDataStorage.setItem).toHaveBeenCalledTimes(1);
      const [key, value] = (secureDataStorage.setItem as jest.Mock).mock
        .calls[0] as [string, string];
      expect(key).toBe(SENSITIVE_STORAGE_KEYS.HASH_KEY);

      const written = JSON.parse(value) as HashKey;
      // Key material is untouched — only the timestamps move.
      expect(written.hashKey).toBe(staleValidKey.hashKey);
      expect(written.salt).toBe(staleValidKey.salt);
      expect(written.generatedAt).toBeGreaterThanOrEqual(before);
      expect(written.expiresAt).toBe(
        (written.generatedAt as number) + HASH_KEY_EXPIRATION_MS,
      );
    });

    it("skips the write while generatedAt is within the throttle window", async () => {
      await refreshHashKeyExpiration({
        ...staleValidKey,
        generatedAt: Date.now() - 60_000, // freshly anchored
      });

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });

    it("never resurrects an expired key", async () => {
      await refreshHashKeyExpiration({
        ...staleValidKey,
        expiresAt: Date.now() - 1000,
      });

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });

    it("never refreshes a rolled-back-clock key (future generatedAt)", async () => {
      await refreshHashKeyExpiration({
        ...staleValidKey,
        generatedAt: Date.now() + 60_000,
        expiresAt: Date.now() + 3_600_000,
      });

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });

    it("refuses to write when the stored key was wiped mid-check (TOCTOU)", async () => {
      // A concurrent logout / corruption wipe (clearTemporaryData) removed the
      // key between the caller's read and this write. Re-stamping the stale
      // snapshot here would resurrect wiped key material with a fresh 72h
      // deadline — and, since the key would then exist without a temporary
      // store, the `!hashKey && !temporaryStore` guard would never fire.
      (getHashKey as jest.Mock).mockResolvedValue(null);

      await refreshHashKeyExpiration(staleValidKey);

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });

    it("refuses to write when the stored key changed mid-check (TOCTOU)", async () => {
      // e.g. a concurrent signIn already re-stamped the key with a
      // credential-verified anchor; our stale snapshot must not clobber it.
      (getHashKey as jest.Mock).mockResolvedValue({
        ...staleValidKey,
        generatedAt: Date.now(),
        expiresAt: Date.now() + HASH_KEY_EXPIRATION_MS,
      });

      await refreshHashKeyExpiration(staleValidKey);

      expect(secureDataStorage.setItem).not.toHaveBeenCalled();
    });

    it("writes exactly once when the stored key is identical to the snapshot", async () => {
      (getHashKey as jest.Mock).mockResolvedValue({ ...staleValidKey });

      await refreshHashKeyExpiration(staleValidKey);

      expect(secureDataStorage.setItem).toHaveBeenCalledTimes(1);
      expect(secureDataStorage.setItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        expect.any(String),
      );
    });

    it("re-stamps a legacy key without generatedAt (and upgrades it)", async () => {
      const { generatedAt, ...legacyKey } = staleValidKey;
      (getHashKey as jest.Mock).mockResolvedValue(legacyKey);

      await refreshHashKeyExpiration(legacyKey);

      expect(secureDataStorage.setItem).toHaveBeenCalledTimes(1);
      const [, value] = (secureDataStorage.setItem as jest.Mock).mock
        .calls[0] as [string, string];
      const written = JSON.parse(value) as HashKey;
      expect(written.generatedAt).toBeDefined();
      expect(written.expiresAt).toBe(
        (written.generatedAt as number) + HASH_KEY_EXPIRATION_MS,
      );
    });
  });
});
