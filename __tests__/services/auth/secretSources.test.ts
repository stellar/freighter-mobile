import { Keypair } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import { SecretSourceType } from "config/types";
import {
  ACCOUNT_SOURCE_VECTORS,
  AUTH_KEYPAIR_VECTORS,
} from "services/auth/authKeypairVectors";
import {
  addSecretSource,
  clearPinnedSourceId,
  clearSecretSources,
  getDefaultMnemonic,
  getPhraseSourceId,
  getPinnedSourceId,
  getSecretKeySourceId,
  getSecretSources,
  pinFirstSource,
  setPinnedSourceId,
} from "services/auth/secretSources";

// Minimal in-memory dataStorage: plain strings, no encoding, so tests can
// inspect exactly what the module persists.
jest.mock("services/storage/storageFactory", () => {
  const memory: Record<string, string> = {};
  return {
    __memory: memory,
    dataStorage: {
      getItem: jest.fn((key: string) => Promise.resolve(memory[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        memory[key] = value;
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          delete memory[key];
        });
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(memory).forEach((key) => {
          delete memory[key];
        });
        return Promise.resolve();
      }),
    },
  };
});

const {
  __memory: memory,
  dataStorage,
}: {
  __memory: Record<string, string>;
  dataStorage: { setItem: jest.Mock };
} = jest.requireMock("services/storage/storageFactory");

const storedSources = () =>
  JSON.parse(memory[STORAGE_KEYS.SECRET_SOURCES] ?? "{}") as Record<
    string,
    unknown
  >;

const PHRASE_A = "a".repeat(64);
const PHRASE_B = "b".repeat(64);
const KEY_C = "c".repeat(64);

beforeEach(() => {
  Object.keys(memory).forEach((key) => {
    delete memory[key];
  });
});

describe("secret source records", () => {
  it("returns an empty set when nothing is stored", async () => {
    expect(await getSecretSources()).toEqual({});
  });

  it("labels phrases and secret keys in independent sequences", async () => {
    const first = await addSecretSource({
      id: PHRASE_A,
      type: SecretSourceType.PHRASE,
    });
    const key = await addSecretSource({
      id: KEY_C,
      type: SecretSourceType.SECRET_KEY,
    });
    const second = await addSecretSource({
      id: PHRASE_B,
      type: SecretSourceType.PHRASE,
    });

    expect(first.label).toBe("Seed Phrase 1");
    expect(key.label).toBe("Secret Key 1");
    expect(second.label).toBe("Seed Phrase 2");
    expect(Object.keys(await getSecretSources())).toEqual([
      PHRASE_A,
      KEY_C,
      PHRASE_B,
    ]);
  });

  it("persists the full record under its id", async () => {
    const before = Date.now();

    const record = await addSecretSource({
      id: PHRASE_A,
      type: SecretSourceType.PHRASE,
    });

    expect(record).toEqual({
      id: PHRASE_A,
      type: SecretSourceType.PHRASE,
      label: "Seed Phrase 1",
      createdAt: expect.any(Number),
    });
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(storedSources()[PHRASE_A]).toEqual(record);
  });

  it("is idempotent by id", async () => {
    const first = await addSecretSource({
      id: PHRASE_A,
      type: SecretSourceType.PHRASE,
    });
    const again = await addSecretSource({
      id: PHRASE_A,
      type: SecretSourceType.PHRASE,
    });

    expect(again).toEqual(first);
    expect(Object.keys(await getSecretSources())).toEqual([PHRASE_A]);
  });

  it("never reuses a label number after a record is removed", async () => {
    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });
    await addSecretSource({ id: PHRASE_B, type: SecretSourceType.PHRASE });
    const sources = storedSources();
    delete sources[PHRASE_A];
    memory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify(sources);

    const third = await addSecretSource({
      id: KEY_C,
      type: SecretSourceType.PHRASE,
    });

    expect(third.label).toBe("Seed Phrase 3");
  });

  it("clears the whole set", async () => {
    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });

    await clearSecretSources();

    expect(memory[STORAGE_KEYS.SECRET_SOURCES]).toBeUndefined();
    expect(await getSecretSources()).toEqual({});
  });

  it("lives under a non-sensitive key that the wipe walks", () => {
    // clearNonSensitiveData removes every STORAGE_KEYS value it does not
    // exempt; the set and the pin must be among them so a wipe clears both.
    expect(Object.values(STORAGE_KEYS)).toEqual(
      expect.arrayContaining([
        STORAGE_KEYS.SECRET_SOURCES,
        STORAGE_KEYS.PINNED_SOURCE_ID,
      ]),
    );
  });
});

describe("pinned source id", () => {
  it("is null until set", async () => {
    expect(await getPinnedSourceId()).toBeNull();
  });

  it("round-trips through plain storage", async () => {
    await setPinnedSourceId(PHRASE_A);

    expect(memory[STORAGE_KEYS.PINNED_SOURCE_ID]).toBe(PHRASE_A);
    expect(await getPinnedSourceId()).toBe(PHRASE_A);
  });

  it("can be cleared", async () => {
    await setPinnedSourceId(PHRASE_A);

    await clearPinnedSourceId();

    expect(await getPinnedSourceId()).toBeNull();
  });

  it("pins the first source a wallet registers", async () => {
    await addSecretSource({ id: KEY_C, type: SecretSourceType.SECRET_KEY });
    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });

    expect(await getPinnedSourceId()).toBe(KEY_C);
  });

  it("does not move a pin that is already set", async () => {
    await setPinnedSourceId(PHRASE_B);

    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });

    expect(await getPinnedSourceId()).toBe(PHRASE_B);
  });

  it("writes the source record before the pin", async () => {
    dataStorage.setItem.mockClear();

    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });

    const keys = dataStorage.setItem.mock.calls.map(([key]) => key);
    expect(keys).toEqual([
      STORAGE_KEYS.SECRET_SOURCES,
      STORAGE_KEYS.PINNED_SOURCE_ID,
    ]);
  });

  /* Rejects the next write to `key` only. */
  const failNextWrite = (key: string) => {
    const write = dataStorage.setItem.getMockImplementation()!;
    dataStorage.setItem.mockImplementation((k: string, value: string) => {
      if (k === key) {
        dataStorage.setItem.mockImplementation(write);
        return Promise.reject(new Error("storage write failed"));
      }
      return write(k, value);
    });
  };

  it("pins nothing when the source record fails to write", async () => {
    failNextWrite(STORAGE_KEYS.SECRET_SOURCES);

    await expect(
      addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE }),
    ).rejects.toThrow("storage write failed");

    expect(await getPinnedSourceId()).toBeNull();
  });

  it("pins the first source on the next registration when the pin write fails", async () => {
    failNextWrite(STORAGE_KEYS.PINNED_SOURCE_ID);
    await expect(
      addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE }),
    ).rejects.toThrow("storage write failed");

    await addSecretSource({ id: KEY_C, type: SecretSourceType.SECRET_KEY });

    expect(await getPinnedSourceId()).toBe(PHRASE_A);
  });

  it("repairs a missing pin when an existing source is re-added", async () => {
    await addSecretSource({ id: PHRASE_A, type: SecretSourceType.PHRASE });
    await addSecretSource({ id: KEY_C, type: SecretSourceType.SECRET_KEY });
    await clearPinnedSourceId();

    await addSecretSource({ id: KEY_C, type: SecretSourceType.SECRET_KEY });

    expect(await getPinnedSourceId()).toBe(PHRASE_A);
  });
});

describe("pinFirstSource", () => {
  const storeSources = (ids: [string, SecretSourceType][]) => {
    memory[STORAGE_KEYS.SECRET_SOURCES] = JSON.stringify(
      Object.fromEntries(ids.map(([id, type]) => [id, { id, type }])),
    );
  };

  it("pins the earliest registered source when no pin is set", async () => {
    storeSources([
      [KEY_C, SecretSourceType.SECRET_KEY],
      [PHRASE_A, SecretSourceType.PHRASE],
    ]);

    expect(await pinFirstSource()).toBe(KEY_C);
    expect(await getPinnedSourceId()).toBe(KEY_C);
  });

  it("leaves a set pin alone", async () => {
    storeSources([[KEY_C, SecretSourceType.SECRET_KEY]]);
    await setPinnedSourceId(PHRASE_B);

    expect(await pinFirstSource()).toBe(PHRASE_B);
    expect(await getPinnedSourceId()).toBe(PHRASE_B);
  });

  it("returns null and pins nothing when no source is registered", async () => {
    expect(await pinFirstSource()).toBeNull();
    expect(await getPinnedSourceId()).toBeNull();
  });
});

describe("source ids", () => {
  it.each(AUTH_KEYPAIR_VECTORS)(
    "derives the pinned phrase source id for vector %#",
    async ({ mnemonic, userId }) => {
      expect(await getPhraseSourceId(mnemonic)).toBe(userId);
    },
  );

  it("rejects a string that is not a BIP39 mnemonic", async () => {
    await expect(getPhraseSourceId("not a mnemonic")).rejects.toThrow(
      "Invalid mnemonic",
    );
  });

  const rows = ACCOUNT_SOURCE_VECTORS.flatMap(({ mnemonic, accounts }) =>
    accounts.map((row) => ({ mnemonic, ...row })),
  );

  it.each(rows)(
    "derives the pinned secret-key source id for %#",
    async ({ mnemonic, secret, publicKey, sourceId }) => {
      const id = await getSecretKeySourceId(secret);
      const phraseId = AUTH_KEYPAIR_VECTORS.find(
        (v) => v.mnemonic === mnemonic,
      )?.userId;

      expect(id).toBe(sourceId);
      expect(id).not.toBe(phraseId);
      expect(id).not.toBe(
        Buffer.from(Keypair.fromPublicKey(publicKey).rawPublicKey()).toString(
          "hex",
        ),
      );
    },
  );

  it("throws on a malformed secret key", async () => {
    await expect(getSecretKeySourceId("SNOTAKEY")).rejects.toThrow();
  });
});

describe("getDefaultMnemonic", () => {
  it("returns the pinned source's mnemonic when it is held", async () => {
    await setPinnedSourceId(PHRASE_B);

    expect(
      await getDefaultMnemonic({
        mnemonics: { [PHRASE_A]: "phrase a", [PHRASE_B]: "phrase b" },
      }),
    ).toEqual({ sourceId: PHRASE_B, mnemonic: "phrase b" });
  });

  it("falls back to the first held phrase when the pin is absent", async () => {
    expect(
      await getDefaultMnemonic({
        mnemonics: { [PHRASE_A]: "phrase a", [PHRASE_B]: "phrase b" },
      }),
    ).toEqual({ sourceId: PHRASE_A, mnemonic: "phrase a" });
  });

  it("falls back to the first held phrase when the pinned source is not held", async () => {
    await setPinnedSourceId(KEY_C);

    expect(
      await getDefaultMnemonic({ mnemonics: { [PHRASE_A]: "phrase a" } }),
    ).toEqual({ sourceId: PHRASE_A, mnemonic: "phrase a" });
  });

  it("returns null when no phrase is held", async () => {
    expect(await getDefaultMnemonic({ mnemonics: {} })).toBeNull();
  });
});
