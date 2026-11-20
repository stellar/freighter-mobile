import { SENSITIVE_STORAGE_KEYS } from "config/constants";
import { HashKey } from "config/types";
import {
  clearTemporaryData,
  getHashKeyGeneration,
  setHashKey,
} from "services/storage/helpers";
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

describe("storage helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks keeps implementations: the held-open promises the tests
    // below install would otherwise hang every later setItem/remove.
    (secureDataStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (secureDataStorage.remove as jest.Mock).mockResolvedValue(undefined);
  });

  describe("hash-key generation", () => {
    it("bumps synchronously when a wipe begins, before any remove lands", async () => {
      const before = getHashKeyGeneration();

      // Hold the removes open so the wipe is genuinely in flight.
      const releaseRemoves: Array<() => void> = [];
      (secureDataStorage.remove as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRemoves.push(resolve);
          }),
      );

      const wipe = clearTemporaryData();

      // An in-flight opportunistic writer (the hash-key re-anchor) checking
      // the generation now — mid-wipe — must already see it moved.
      expect(getHashKeyGeneration()).toBe(before + 1);

      releaseRemoves.forEach((release) => release());
      await wipe;
      expect(getHashKeyGeneration()).toBe(before + 1);
    });

    it("bumps synchronously when a credential-verified key write begins, before it lands", async () => {
      // A signIn rebuild mints a new key while a re-anchor's re-read is in
      // flight. The re-anchor's write-time check must already see the
      // generation moved, or it would write the OLD key back under a
      // temporary store the rebuild re-encrypted with the new one.
      const before = getHashKeyGeneration();

      let releaseWrite: () => void = () => {};
      (secureDataStorage.setItem as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseWrite = resolve;
          }),
      );

      const newKey: HashKey = {
        hashKey: "new-hash-key",
        salt: "new-salt",
        generatedAt: 1_800_000_000_000,
        expiresAt: 1_800_000_000_000 + 1,
      };
      const write = setHashKey(newKey);

      expect(getHashKeyGeneration()).toBe(before + 1);
      expect(secureDataStorage.setItem).toHaveBeenCalledWith(
        SENSITIVE_STORAGE_KEYS.HASH_KEY,
        JSON.stringify(newKey),
      );

      releaseWrite();
      await write;
      expect(getHashKeyGeneration()).toBe(before + 1);
    });
  });
});
