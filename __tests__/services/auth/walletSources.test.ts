import { Keypair, xdr } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { MnemonicMap, SecretSourceType } from "config/types";
import { getHeldSecrets, isSessionAuthValid } from "ducks/auth";
import {
  ACCOUNT_SOURCE_VECTORS,
  AUTH_KEYPAIR_VECTORS,
  SOURCE_IDENTITY_VECTOR,
} from "services/auth/authKeypairVectors";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";
import { getWalletSources } from "services/auth/walletSources";
import { clearCachedWalletSources } from "services/auth/walletSourcesCache";
import { getHashKey } from "services/storage/helpers";

// Real derivations, counted: the cache tests assert how often a phrase is
// derived.
jest.mock("services/auth/deriveAuthKeypair", () => {
  const actual = jest.requireActual("services/auth/deriveAuthKeypair");
  return { ...actual, deriveAuthKeypair: jest.fn(actual.deriveAuthKeypair) };
});

jest.mock("ducks/auth", () => ({
  getHeldSecrets: jest.fn(),
  isSessionAuthValid: jest.fn(),
}));

jest.mock("services/storage/helpers", () => ({
  getHashKey: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const mockDeriveAuthKeypair = deriveAuthKeypair as jest.Mock;
const mockGetHeldSecrets = getHeldSecrets as jest.Mock;
const mockIsSessionAuthValid = isSessionAuthValid as jest.Mock;
const mockGetHashKey = getHashKey as jest.Mock;

const [phraseA, phraseB] = ACCOUNT_SOURCE_VECTORS;
const phraseId = (mnemonic: string) => {
  const vector = AUTH_KEYPAIR_VECTORS.find((v) => v.mnemonic === mnemonic);
  if (!vector) {
    throw new Error("no phrase vector for mnemonic");
  }
  return vector.userId;
};

// A key no held phrase derives: the fixed seed SOURCE_IDENTITY_VECTOR pins.
const importedSecret = Keypair.fromRawEd25519Seed(
  Buffer.from(SOURCE_IDENTITY_VECTOR.seed32Hex, "hex"),
).secret();

/*
  Lays out an unlocked wallet as signIn leaves it: the account ids in list
  order, the private key held for each (null for a gap), the held phrase map,
  and the hash key.
*/
const unlock = ({
  accounts,
  mnemonics,
  hashKey = "hash-key",
}: {
  accounts: Record<string, string | null>;
  mnemonics: MnemonicMap;
  hashKey?: string;
}) => {
  const privateKeys: Record<string, string> = {};
  Object.entries(accounts).forEach(([id, secret]) => {
    if (secret) {
      privateKeys[id] = secret;
    }
  });
  mockGetHeldSecrets.mockResolvedValue({
    accountIds: Object.keys(accounts),
    privateKeys,
    mnemonics,
  });
  mockGetHashKey.mockResolvedValue({ hashKey, salt: "salt" });
};

const twoPhraseWallet = (imported: string, hashKey?: string) =>
  unlock({
    hashKey,
    accounts: {
      "key-a0": phraseA.accounts[0].secret,
      "key-a1": phraseA.accounts[1].secret,
      "key-b0": phraseB.accounts[0].secret,
      "key-imported": imported,
    },
    mnemonics: {
      [phraseId(phraseA.mnemonic)]: phraseA.mnemonic,
      [phraseId(phraseB.mnemonic)]: phraseB.mnemonic,
    },
  });

describe("getWalletSources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedWalletSources();
    mockIsSessionAuthValid.mockResolvedValue(true);
  });

  it("enumerates two phrases, three derived accounts and one imported key", async () => {
    twoPhraseWallet(importedSecret);

    const { sources, signers } = await getWalletSources();

    expect(sources).toEqual([
      { id: phraseId(phraseA.mnemonic), kind: SecretSourceType.PHRASE },
      { id: phraseId(phraseB.mnemonic), kind: SecretSourceType.PHRASE },
      { id: phraseA.accounts[0].sourceId, kind: SecretSourceType.SECRET_KEY },
      { id: phraseA.accounts[1].sourceId, kind: SecretSourceType.SECRET_KEY },
      { id: phraseB.accounts[0].sourceId, kind: SecretSourceType.SECRET_KEY },
      {
        id: SOURCE_IDENTITY_VECTOR.sourceId,
        kind: SecretSourceType.SECRET_KEY,
      },
    ]);
    expect([...signers.keys()]).toEqual(sources.map(({ id }) => id));
    // Each signer is the keypair whose public key is the source id.
    signers.forEach((keypair, id) => {
      expect(xdr.encodeBytes(keypair.rawPublicKey(), "hex")).toBe(id);
    });
  });

  it("lists an imported key that a held phrase also derives once", async () => {
    twoPhraseWallet(phraseA.accounts[1].secret);

    const { sources, signers } = await getWalletSources();

    expect(
      sources.filter(({ id }) => id === phraseA.accounts[1].sourceId),
    ).toHaveLength(1);
    expect(sources).toHaveLength(5);
    expect(signers.size).toBe(5);
  });

  it("produces nothing while the session is not valid", async () => {
    twoPhraseWallet(importedSecret);
    mockIsSessionAuthValid.mockResolvedValue(false);

    const { sources, signers } = await getWalletSources();

    expect(sources).toEqual([]);
    expect(signers.size).toBe(0);
    expect(mockGetHeldSecrets).not.toHaveBeenCalled();
  });

  it("produces nothing when the held secrets are unavailable", async () => {
    twoPhraseWallet(importedSecret);
    mockGetHeldSecrets.mockResolvedValue(null);

    const { sources, signers } = await getWalletSources();

    expect(sources).toEqual([]);
    expect(signers.size).toBe(0);
  });

  it("skips and reports a phrase it cannot derive, keeping the rest", async () => {
    unlock({
      accounts: { "key-imported": importedSecret },
      mnemonics: {
        "id-bad": "not a valid phrase",
        [phraseId(phraseA.mnemonic)]: phraseA.mnemonic,
      },
    });

    const { sources } = await getWalletSources();

    expect(sources.map(({ id }) => id)).toEqual([
      phraseId(phraseA.mnemonic),
      SOURCE_IDENTITY_VECTOR.sourceId,
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "getWalletSources",
      "Failed to derive a phrase source",
      expect.any(Error),
    );
  });

  it("uses a phrase keypair the caller already derived", async () => {
    twoPhraseWallet(importedSecret);
    const seeded = await deriveAuthKeypair(phraseA.mnemonic);
    mockDeriveAuthKeypair.mockClear();

    const { signers } = await getWalletSources({
      phraseSigners: new Map([[phraseId(phraseA.mnemonic), seeded.keypair]]),
    });

    expect(signers.get(phraseId(phraseA.mnemonic))).toBe(seeded.keypair);
    expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(1);
    expect(mockDeriveAuthKeypair).toHaveBeenCalledWith(phraseB.mnemonic);
  });

  describe("cache", () => {
    it("keeps a set missing an account's private key, and reports it", async () => {
      unlock({
        accounts: {
          "key-a0": phraseA.accounts[0].secret,
          "key-unheld": null,
        },
        mnemonics: { [phraseId(phraseA.mnemonic)]: phraseA.mnemonic },
      });

      const first = await getWalletSources();
      const second = await getWalletSources();

      expect(first.sources.map(({ id }) => id)).toEqual([
        phraseId(phraseA.mnemonic),
        phraseA.accounts[0].sourceId,
      ]);
      expect(second).toBe(first);
      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "getWalletSources",
        "No private key held for an account",
        expect.any(Error),
      );
    });

    // Mobile-only: getActiveAccount can fill a gap mid-session without the
    // account list changing.
    it("re-derives once a missing private key is held", async () => {
      unlock({
        accounts: {
          "key-a0": phraseA.accounts[0].secret,
          "key-a1": null,
        },
        mnemonics: { [phraseId(phraseA.mnemonic)]: phraseA.mnemonic },
      });
      expect((await getWalletSources()).sources).toHaveLength(2);

      unlock({
        accounts: {
          "key-a0": phraseA.accounts[0].secret,
          "key-a1": phraseA.accounts[1].secret,
        },
        mnemonics: { [phraseId(phraseA.mnemonic)]: phraseA.mnemonic },
      });

      expect((await getWalletSources()).sources).toHaveLength(3);
    });

    it("derives the phrases once per unlock", async () => {
      twoPhraseWallet(importedSecret);

      const first = await getWalletSources();
      const second = await getWalletSources();

      expect(second).toBe(first);
      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(2);
    });

    it("re-derives after a new unlock", async () => {
      twoPhraseWallet(importedSecret);
      await getWalletSources();

      // A full sign-in generates a fresh hash key.
      twoPhraseWallet(importedSecret, "next-hash-key");
      const { sources } = await getWalletSources();

      expect(sources).toHaveLength(6);
      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(4);
    });

    it("re-derives when an account is added mid-session", async () => {
      unlock({
        accounts: { "key-a0": phraseA.accounts[0].secret },
        mnemonics: { [phraseId(phraseA.mnemonic)]: phraseA.mnemonic },
      });
      expect((await getWalletSources()).sources).toHaveLength(2);

      unlock({
        accounts: {
          "key-a0": phraseA.accounts[0].secret,
          "key-imported": importedSecret,
        },
        mnemonics: { [phraseId(phraseA.mnemonic)]: phraseA.mnemonic },
      });

      expect((await getWalletSources()).sources).toHaveLength(3);
    });

    it("shares one derivation between concurrent callers", async () => {
      twoPhraseWallet(importedSecret);

      const [first, second] = await Promise.all([
        getWalletSources(),
        getWalletSources(),
      ]);

      expect(second).toBe(first);
      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(2);
    });

    it("does not keep a set missing a source that failed, so it retries", async () => {
      twoPhraseWallet(importedSecret);
      mockDeriveAuthKeypair.mockRejectedValueOnce(new Error("transient"));

      expect((await getWalletSources()).sources).toHaveLength(5);
      expect((await getWalletSources()).sources).toHaveLength(6);
    });

    it("does not cache a derivation that a lock overtook", async () => {
      twoPhraseWallet(importedSecret);

      const inFlight = getWalletSources();
      clearCachedWalletSources();
      await inFlight;

      // Unlock again under the same hash key, as the soft-unlock fast path
      // does: a stale entry would be served here.
      mockDeriveAuthKeypair.mockClear();
      await getWalletSources();

      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(2);
    });

    it("returns nothing to a caller whose derivation a lock overtook", async () => {
      const { deriveAuthKeypair: actual } = jest.requireActual(
        "services/auth/deriveAuthKeypair",
      );
      let reached: () => void = () => {};
      const derivationReached = new Promise<void>((resolve) => {
        reached = resolve;
      });
      let release: () => void = () => {};
      const derivationReleased = new Promise<void>((resolve) => {
        release = resolve;
      });
      // Pause after the secrets are read, while the first phrase is deriving.
      mockDeriveAuthKeypair.mockImplementationOnce(async (mnemonic: string) => {
        reached();
        await derivationReleased;
        return actual(mnemonic);
      });
      twoPhraseWallet(importedSecret);

      const inFlight = getWalletSources();
      await derivationReached;
      clearCachedWalletSources();
      release();

      const { sources, signers } = await inFlight;
      expect(sources).toEqual([]);
      expect(signers.size).toBe(0);
    });

    it("is dropped by clearCachedWalletSources", async () => {
      twoPhraseWallet(importedSecret);
      await getWalletSources();

      clearCachedWalletSources();
      // Same hash key, so only the cleared cache can explain a re-derivation.
      await getWalletSources();

      expect(mockDeriveAuthKeypair).toHaveBeenCalledTimes(4);
    });
  });
});
