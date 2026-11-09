import { Keypair, xdr } from "@stellar/stellar-sdk";
import { SecretSourceType } from "config/types";
import {
  ACCOUNT_SOURCE_VECTORS,
  AUTH_KEYPAIR_VECTORS,
  SOURCE_IDENTITY_VECTOR,
} from "services/auth/authKeypairVectors";
import {
  deriveAuthKeypair,
  deriveSourceIdentity,
} from "services/auth/deriveAuthKeypair";
import { getPinnedSourceId } from "services/auth/secretSources";
import { getSigningIdentity } from "services/auth/signingIdentity";
import {
  buildUserLinkBodies,
  buildUserLinkRequest,
  signUserLinkBody,
} from "services/auth/userLink";
import {
  buildLinkConsentMessage,
  MAX_LINK_SOURCES,
  UserLinkBody,
} from "services/auth/userLinkConsent";
import { getWalletSources, WalletSource } from "services/auth/walletSources";

jest.mock("services/auth/signingIdentity", () => ({
  getSigningIdentity: jest.fn(),
}));

jest.mock("services/auth/walletSources", () => ({
  getWalletSources: jest.fn(),
}));

jest.mock("services/auth/secretSources", () => ({
  getPinnedSourceId: jest.fn(),
}));

const mockGetSigningIdentity = getSigningIdentity as jest.Mock;
const mockGetWalletSources = getWalletSources as jest.Mock;
const mockGetPinnedSourceId = getPinnedSourceId as jest.Mock;

const IAT = 1_761_000_000;
const [phrase] = ACCOUNT_SOURCE_VECTORS;

/*
  A wallet holding one phrase, its first two derived accounts and one key
  imported on its own, derived for real from the pinned vectors.
*/
const makeWallet = async () => {
  const signers = new Map<string, Keypair>();
  const sources: WalletSource[] = [];
  const add = (id: string, kind: SecretSourceType, keypair: Keypair) => {
    sources.push({ id, kind });
    signers.set(id, keypair);
  };

  const { userId, keypair } = await deriveAuthKeypair(phrase.mnemonic);
  add(userId, SecretSourceType.PHRASE, keypair);
  const derived = await Promise.all(
    phrase.accounts
      .slice(0, 2)
      .map(({ secret }) =>
        deriveSourceIdentity(Keypair.fromSecret(secret).rawSecretKey()),
      ),
  );
  derived.forEach(({ sourceId, keypair: signer }) =>
    add(sourceId, SecretSourceType.SECRET_KEY, signer),
  );
  const imported = await deriveSourceIdentity(
    Buffer.from(SOURCE_IDENTITY_VECTOR.seed32Hex, "hex"),
  );
  add(imported.sourceId, SecretSourceType.SECRET_KEY, imported.keypair);

  return {
    sources,
    signers,
    identity: { sourceId: userId, keypair },
  };
};

/* Random secret_key sources, for the size bound. */
const makeManySources = (count: number) => {
  const sources: WalletSource[] = [];
  const signers = new Map<string, Keypair>();
  Array.from({ length: count }, () => Keypair.random()).forEach((keypair) => {
    const id = xdr.encodeBytes(keypair.rawPublicKey(), "hex");
    sources.push({ id, kind: SecretSourceType.SECRET_KEY });
    signers.set(id, keypair);
  });
  return { sources, signers };
};

const ids = (body: UserLinkBody) => body.sources.map(({ id }) => id);

const expectConsentsVerify = (body: UserLinkBody, sub: string, iat: number) => {
  body.sources.forEach(({ id, kind, sig }) => {
    const message = buildLinkConsentMessage({
      id,
      kind,
      signingSourceId: sub,
      iat,
    });
    const verifier = new Keypair({
      type: "ed25519",
      publicKey: Buffer.from(id, "hex"),
    });
    expect(
      verifier.verify(Buffer.from(message, "utf8"), Buffer.from(sig, "base64")),
    ).toBe(true);
  });
};

describe("buildUserLinkBodies", () => {
  it("carries a phrase, its derived accounts and an imported key with their kinds", async () => {
    const wallet = await makeWallet();

    const bodies = buildUserLinkBodies({ ...wallet, iat: IAT });

    expect(bodies).toHaveLength(1);
    const [body] = bodies;
    expect(body.sources.map(({ id, kind }) => ({ id, kind }))).toEqual([
      {
        id: AUTH_KEYPAIR_VECTORS[0].userId,
        kind: SecretSourceType.PHRASE,
      },
      { id: phrase.accounts[0].sourceId, kind: SecretSourceType.SECRET_KEY },
      { id: phrase.accounts[1].sourceId, kind: SecretSourceType.SECRET_KEY },
      {
        id: SOURCE_IDENTITY_VECTOR.sourceId,
        kind: SecretSourceType.SECRET_KEY,
      },
    ]);
    expectConsentsVerify(body, wallet.identity.sourceId, IAT);
  });

  it("puts the signing source in every body, even once it is linked", async () => {
    const wallet = await makeWallet();
    const sub = wallet.identity.sourceId;

    const bodies = buildUserLinkBodies({
      ...wallet,
      linkedIds: new Set([sub, phrase.accounts[0].sourceId]),
      iat: IAT,
    });

    expect(bodies.map(ids)).toEqual([
      [sub, phrase.accounts[1].sourceId, SOURCE_IDENTITY_VECTOR.sourceId],
    ]);
  });

  it("puts the signing source in the body when a key, not the phrase, signs", async () => {
    const wallet = await makeWallet();
    const keySigner = wallet.sources[3].id;

    const [body] = buildUserLinkBodies({
      ...wallet,
      identity: {
        sourceId: keySigner,
        keypair: wallet.signers.get(keySigner)!,
      },
      iat: IAT,
    });

    expect(ids(body)[0]).toBe(keySigner);
    expect(ids(body)).toHaveLength(4);
    expectConsentsVerify(body, keySigner, IAT);
  });

  it("sends the signing source alone when nothing else is held", async () => {
    const wallet = await makeWallet();
    const [sub] = wallet.sources;

    expect(
      buildUserLinkBodies({ ...wallet, sources: [sub], iat: IAT }).map(ids),
    ).toEqual([[sub.id]]);
  });

  it("sends nothing once every source is linked", async () => {
    const wallet = await makeWallet();

    expect(
      buildUserLinkBodies({
        ...wallet,
        linkedIds: new Set(wallet.sources.map(({ id }) => id)),
        iat: IAT,
      }),
    ).toEqual([]);
  });

  it("dedupes by id, one consent per id", async () => {
    const wallet = await makeWallet();

    const [body] = buildUserLinkBodies({
      ...wallet,
      sources: [...wallet.sources, wallet.sources[2], wallet.sources[0]],
      iat: IAT,
    });

    expect(ids(body)).toEqual(wallet.sources.map(({ id }) => id));
  });

  it("splits a large set into bodies of at most MAX_LINK_SOURCES, each carrying the signer", async () => {
    const wallet = await makeWallet();
    const many = makeManySources(300);
    const sources = [...wallet.sources, ...many.sources];
    const signers = new Map([...wallet.signers, ...many.signers]);
    const sub = wallet.identity.sourceId;

    const bodies = buildUserLinkBodies({
      identity: wallet.identity,
      sources,
      signers,
      iat: IAT,
    });

    // `sub` takes one slot in every body.
    expect(bodies.length).toBe(
      Math.ceil((sources.length - 1) / (MAX_LINK_SOURCES - 1)),
    );
    expect(bodies[0].sources).toHaveLength(MAX_LINK_SOURCES);
    bodies.forEach((body) => {
      expect(body.sources.length).toBeLessThanOrEqual(MAX_LINK_SOURCES);
      expect(ids(body)[0]).toBe(sub);
      expect(new Set(ids(body)).size).toBe(body.sources.length);
    });
    const others = bodies.flatMap((body) => ids(body).slice(1));
    expect(others).toHaveLength(sources.length - 1);
    expect(new Set([sub, ...others])).toEqual(
      new Set(sources.map(({ id }) => id)),
    );
    expectConsentsVerify(bodies[bodies.length - 1], sub, IAT);
  });

  it("binds every consent to the signer and iat", async () => {
    const wallet = await makeWallet();
    const [body] = buildUserLinkBodies({ ...wallet, iat: IAT });

    expect(() =>
      expectConsentsVerify(body, wallet.identity.sourceId, IAT + 1),
    ).toThrow();
    expect(() =>
      expectConsentsVerify(body, SOURCE_IDENTITY_VECTOR.sourceId, IAT),
    ).toThrow();
  });

  it("throws when the signing source is not among the sources", async () => {
    const wallet = await makeWallet();

    expect(() =>
      buildUserLinkBodies({
        ...wallet,
        sources: wallet.sources.slice(1),
        iat: IAT,
      }),
    ).toThrow("the signing source is not held");
  });
});

describe("buildUserLinkRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when the session holds no signer", async () => {
    mockGetSigningIdentity.mockResolvedValue(null);

    expect(await buildUserLinkRequest()).toBeNull();
    expect(mockGetWalletSources).not.toHaveBeenCalled();
  });

  it("returns null when the signer is the fallback, not the pin", async () => {
    const wallet = await makeWallet();
    // The pinned source did not derive this unlock, so getSigningIdentity
    // fell back to the first held source.
    mockGetSigningIdentity.mockResolvedValue(wallet.identity);
    mockGetPinnedSourceId.mockResolvedValue("a".repeat(64));

    expect(await buildUserLinkRequest()).toBeNull();
    expect(mockGetWalletSources).not.toHaveBeenCalled();
  });

  it("returns null when no pin is stored", async () => {
    const wallet = await makeWallet();
    mockGetSigningIdentity.mockResolvedValue(wallet.identity);
    mockGetPinnedSourceId.mockResolvedValue(null);

    expect(await buildUserLinkRequest()).toBeNull();
    expect(mockGetWalletSources).not.toHaveBeenCalled();
  });

  it("returns null when the session locks after the identity resolves", async () => {
    const wallet = await makeWallet();
    mockGetSigningIdentity.mockResolvedValue(wallet.identity);
    mockGetPinnedSourceId.mockResolvedValue(wallet.identity.sourceId);
    // A lock landed during getSigningIdentity's pin read: the sources are gone.
    mockGetWalletSources.mockResolvedValue({ sources: [], signers: new Map() });

    expect(await buildUserLinkRequest()).toBeNull();
  });

  it("batches the held sources, each batch signable under its own iat", async () => {
    const wallet = await makeWallet();
    const many = makeManySources(200);
    mockGetSigningIdentity.mockResolvedValue(wallet.identity);
    mockGetPinnedSourceId.mockResolvedValue(wallet.identity.sourceId);
    mockGetWalletSources.mockResolvedValue({
      sources: [...wallet.sources, ...many.sources],
      signers: new Map([...wallet.signers, ...many.signers]),
    });

    const result = await buildUserLinkRequest();

    expect(result?.identity).toBe(wallet.identity);
    // `sub` takes one slot in every batch.
    expect(result?.batches).toHaveLength(
      Math.ceil((wallet.sources.length + 200 - 1) / (MAX_LINK_SOURCES - 1)),
    );
    result!.batches.forEach((batch, i) => {
      const body = signUserLinkBody({
        identity: result!.identity,
        signers: result!.signers,
        batch,
        iat: IAT + i * 20,
      });
      expect(body.sources[0].id).toBe(wallet.identity.sourceId);
      expectConsentsVerify(body, wallet.identity.sourceId, IAT + i * 20);
    });
  });
});
