import { Keypair } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { MnemonicMap, SecretSourceType } from "config/types";
import { getHeldSecrets, isSessionAuthValid } from "ducks/auth";
import {
  ACCOUNT_SOURCE_VECTORS,
  AUTH_KEYPAIR_VECTORS,
  SOURCE_IDENTITY_VECTOR,
} from "services/auth/authKeypairVectors";
import { buildAuthJwt } from "services/auth/buildAuthJwt";
import {
  addSecretSource,
  clearPinnedSourceId,
  clearSecretSources,
  getPinnedSourceId,
  setPinnedSourceId,
} from "services/auth/secretSources";
import { getSigningIdentity } from "services/auth/signingIdentity";
import { getWalletSources } from "services/auth/walletSources";
import { clearCachedWalletSources } from "services/auth/walletSourcesCache";
import { getHashKey } from "services/storage/helpers";

// Real derivations and the real sources store; only the session gate, the
// held secrets and plain storage are stubbed.
jest.mock("services/auth/walletSources", () => {
  const actual = jest.requireActual("services/auth/walletSources");
  return { ...actual, getWalletSources: jest.fn(actual.getWalletSources) };
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
      remove: jest.fn((key: string) => {
        delete memory[key];
        return Promise.resolve();
      }),
    },
  };
});

const { __memory: memory } = jest.requireMock<{
  __memory: Record<string, string>;
}>("services/storage/storageFactory");

const mockGetWalletSources = getWalletSources as jest.Mock;
const mockGetHeldSecrets = getHeldSecrets as jest.Mock;
const mockIsSessionAuthValid = isSessionAuthValid as jest.Mock;
const mockGetHashKey = getHashKey as jest.Mock;

const [phraseA] = ACCOUNT_SOURCE_VECTORS;
const phraseAId = AUTH_KEYPAIR_VECTORS.find(
  (v) => v.mnemonic === phraseA.mnemonic,
)!.userId;

// A key no held phrase derives: the fixed seed SOURCE_IDENTITY_VECTOR pins.
const importedSecret = Keypair.fromRawEd25519Seed(
  Buffer.from(SOURCE_IDENTITY_VECTOR.seed32Hex, "hex"),
).secret();
const importedId = SOURCE_IDENTITY_VECTOR.sourceId;

const phrase = { id: phraseAId, type: SecretSourceType.PHRASE };
const key = { id: importedId, type: SecretSourceType.SECRET_KEY };

/* Decodes a compact JWS and checks its signature against `sub`. */
const verifyJwt = (jwt: string) => {
  const [header, payload, signature] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    sub: string;
  };
  // `sub` is the raw public key in hex, so it alone verifies the signature.
  const signer = new Keypair({
    type: "ed25519",
    publicKey: Buffer.from(claims.sub, "hex"),
  });
  return {
    sub: claims.sub,
    verifies: signer.verify(
      Buffer.from(`${header}.${payload}`, "utf8"),
      Buffer.from(signature, "base64url"),
    ),
  };
};

/*
  Lays out an unlocked wallet as signIn leaves it, registering sources in
  `order` the way the creation paths do, so the first one takes the pin.
*/
const unlock = async ({
  accounts,
  mnemonics = {},
  order,
  locked = false,
}: {
  accounts: Record<string, string>;
  mnemonics?: MnemonicMap;
  order: { id: string; type: SecretSourceType }[];
  locked?: boolean;
}) => {
  await order.reduce(
    (previous, source) =>
      previous.then(async () => {
        await addSecretSource(source);
      }),
    Promise.resolve(),
  );

  [memory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID]] = Object.keys(accounts);
  mockIsSessionAuthValid.mockResolvedValue(!locked);
  mockGetHashKey.mockResolvedValue({ hashKey: "hash-key", salt: "salt" });
  mockGetHeldSecrets.mockResolvedValue(
    locked
      ? null
      : {
          accountIds: Object.keys(accounts),
          privateKeys: accounts,
          mnemonics,
        },
  );
};

describe("getSigningIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedWalletSources();
    Object.keys(memory).forEach((k) => {
      delete memory[k];
    });
  });

  it("signs a secret-key-only wallet with the key's source identity", async () => {
    await unlock({
      accounts: { "key-imported": importedSecret },
      order: [key],
    });

    const identity = await getSigningIdentity();

    expect(identity?.sourceId).toBe(importedId);
    const jwt = buildAuthJwt({
      keypair: identity!.keypair,
      method: "GET",
      path: "/api/v1/user",
    });
    expect(verifyJwt(jwt)).toEqual({ sub: importedId, verifies: true });
  });

  it("signs with the phrase when the phrase came before an imported key", async () => {
    await unlock({
      accounts: {
        "key-a0": phraseA.accounts[0].secret,
        "key-imported": importedSecret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [phrase, key],
    });

    expect((await getSigningIdentity())?.sourceId).toBe(phraseAId);
  });

  it("signs with the key when the key came before a phrase", async () => {
    await unlock({
      accounts: {
        "key-imported": importedSecret,
        "key-a0": phraseA.accounts[0].secret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [key, phrase],
    });

    expect((await getSigningIdentity())?.sourceId).toBe(importedId);
  });

  it("does not follow the active account", async () => {
    await unlock({
      accounts: {
        "key-a0": phraseA.accounts[0].secret,
        "key-imported": importedSecret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [phrase, key],
    });

    const ids = await ["key-a0", "key-imported"].reduce(
      async (previous, active) => {
        const acc = await previous;
        memory[STORAGE_KEYS.ACTIVE_ACCOUNT_ID] = active;
        acc.push((await getSigningIdentity())?.sourceId);
        return acc;
      },
      Promise.resolve([] as (string | undefined)[]),
    );

    expect(ids).toEqual([phraseAId, phraseAId]);
  });

  it("falls back to a held source, without moving the pin, when the pinned source is not held", async () => {
    await unlock({
      accounts: { "key-imported": importedSecret },
      order: [key],
    });
    await setPinnedSourceId(phraseAId);

    expect((await getSigningIdentity())?.sourceId).toBe(importedId);
    expect(await getPinnedSourceId()).toBe(phraseAId);
    expect(logger.error).toHaveBeenCalledWith(
      "getSigningIdentity",
      "The pinned source is not held",
      expect.any(Error),
    );
  });

  it("prefers a held phrase over a key when falling back", async () => {
    await unlock({
      accounts: {
        "key-imported": importedSecret,
        "key-a0": phraseA.accounts[0].secret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [],
    });
    await setPinnedSourceId("f".repeat(64));

    expect((await getSigningIdentity())?.sourceId).toBe(phraseAId);
  });

  it("signs as the earliest registered source, without pinning it, when the wallet has no pin", async () => {
    // Held sources list phrases first, so the key is not the first held one.
    await unlock({
      accounts: {
        "key-imported": importedSecret,
        "key-a0": phraseA.accounts[0].secret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [key, phrase],
    });
    await clearPinnedSourceId();

    expect((await getSigningIdentity())?.sourceId).toBe(importedId);
    expect(await getPinnedSourceId()).toBeNull();
  });

  it("signs as a held phrase, without pinning it, when the wallet has no pin and no records", async () => {
    await unlock({
      accounts: {
        "key-imported": importedSecret,
        "key-a0": phraseA.accounts[0].secret,
      },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [],
    });

    expect((await getSigningIdentity())?.sourceId).toBe(phraseAId);
    expect(await getPinnedSourceId()).toBeNull();
  });

  // The PR #94 repro: the phrase fails to derive on one request, so only
  // account 0's key is held. That key must not become the identity.
  it("returns null, and pins nothing, when the wallet has no pin, no records and no held phrase", async () => {
    await unlock({ accounts: { "key-imported": importedSecret }, order: [] });

    expect(await getSigningIdentity()).toBeNull();
    expect(await getPinnedSourceId()).toBeNull();

    // The phrase derives on the next request, and the registration that
    // follows pins it.
    clearCachedWalletSources();
    mockGetHeldSecrets.mockResolvedValue({
      accountIds: ["key-a0"],
      privateKeys: { "key-a0": phraseA.accounts[0].secret },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
    });
    expect((await getSigningIdentity())?.sourceId).toBe(phraseAId);
    await addSecretSource(phrase);
    expect(await getPinnedSourceId()).toBe(phraseAId);
  });

  it("does not pin the old wallet's source when a request overlaps a wallet wipe", async () => {
    await unlock({
      accounts: { "key-a0": phraseA.accounts[0].secret },
      mnemonics: { [phraseAId]: phraseA.mnemonic },
      order: [phrase],
    });
    const newPhraseId = "b".repeat(64);
    const actual = jest.requireActual("services/auth/walletSources");
    // The wipe lands mid-derivation, so the derivation still returns the old
    // wallet's sources.
    mockGetWalletSources.mockImplementationOnce(async (...args: unknown[]) => {
      const sources = await actual.getWalletSources(...args);
      await clearSecretSources();
      await clearPinnedSourceId();
      return sources;
    });

    await getSigningIdentity();
    await addSecretSource({ id: newPhraseId, type: SecretSourceType.PHRASE });

    expect(await getPinnedSourceId()).toBe(newPhraseId);
  });

  it("returns null while locked", async () => {
    await unlock({
      accounts: { "key-imported": importedSecret },
      order: [key],
      locked: true,
    });

    expect(await getSigningIdentity()).toBeNull();
  });

  it("returns null when the session holds no secrets", async () => {
    await unlock({ accounts: {}, order: [key] });

    expect(await getSigningIdentity()).toBeNull();
  });

  it("reports an unexpected failure and returns null", async () => {
    await unlock({
      accounts: { "key-imported": importedSecret },
      order: [key],
    });
    const error = new Error("derivation failed");
    mockGetWalletSources.mockRejectedValueOnce(error);

    expect(await getSigningIdentity()).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "getSigningIdentity",
      "Unexpected error",
      error,
    );
  });
});
