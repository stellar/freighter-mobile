/**
 * Gated E2E integration test: identity continuity and clustering (#70)
 * against a live freighter-backend-v2, driven over HTTP the way
 * linkWalletSources drives it: every request is signed by the wallet's pinned
 * source, and every source in a /user/link body signs its own consent. No
 * app, so it covers the multi-phrase cases the UI can't produce yet.
 *
 * HOW TO RUN (it writes users, so point it at a local backend):
 *   IS_INTEGRATION_MODE=1 \
 *     yarn jest __tests__/services/auth/userClusters.integration.test.ts
 *
 * Env:  BACKEND_V2_URL            (default: http://localhost:3002)
 *       BACKEND_V2_DB_CONTAINER   (optional, e.g. freighter-backend-postgres):
 *                                 also asserts row ownership and counts in
 *                                 Postgres via `docker exec psql`.
 *
 * Normal CI: suite is SKIPPED — set neither env var and all tests are omitted.
 *
 * Every phrase in the clustering steps is random per run, and each link that
 * should add a source first checks the source is unlinked. Reruns against the
 * same database therefore test new rows, never ones a previous run left. Only
 * the shipped-id test uses the `abandon ... about` vector, and it asserts the
 * root alone, which never moves once set.
 */
import { Keypair } from "@stellar/stellar-sdk";
import { generateMnemonic } from "bip39";
import { execFileSync } from "child_process";
import { SecretSourceType } from "config/types";
import { buildAuthJwt, issuedAtSeconds } from "services/auth/buildAuthJwt";
import {
  deriveAuthKeypair,
  deriveSourceIdentity,
} from "services/auth/deriveAuthKeypair";
import {
  buildLinkConsentMessage,
  MAX_LINK_SOURCES,
  signLinkConsent,
} from "services/auth/userLinkConsent";
import StellarHDWallet from "stellar-hd-wallet";

// ---------------------------------------------------------------------------
// Gating: skip the whole suite unless an integration flag is present
// ---------------------------------------------------------------------------
const RUN = !!(process.env.BACKEND_V2_URL || process.env.IS_INTEGRATION_MODE);
const d = RUN ? describe : describe.skip;

const BASE_URL = process.env.BACKEND_V2_URL || "http://localhost:3002";
const DB_CONTAINER = process.env.BACKEND_V2_DB_CONTAINER;
const USER_PATH = "/api/v1/user";
const LINK_PATH = "/api/v1/user/link";

const SHIPPED_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
// The METRICS_USER_ID of every shipped wallet holding SHIPPED_PHRASE. Frozen.
const SHIPPED_USER_ID =
  "ec57e5d04783b5ade776621ab171b3b197c3acc0a1cb5bad10786dc8e381e797";

interface Source {
  id: string;
  kind: SecretSourceType;
  keypair: Keypair;
}

interface UserBody {
  userId: string;
  sources: { id: string; kind: string }[];
  conflicts?: string[];
}

const phraseSource = async (mnemonic: string): Promise<Source> => {
  const { userId, keypair } = await deriveAuthKeypair(mnemonic);
  return { id: userId, kind: SecretSourceType.PHRASE, keypair };
};

const keySource = async (account: Keypair): Promise<Source> => {
  const { sourceId, keypair } = await deriveSourceIdentity(
    account.rawSecretKey(),
  );
  return { id: sourceId, kind: SecretSourceType.SECRET_KEY, keypair };
};

// The account at m/44'/148'/index', as the auth duck derives it. See
// deriveAuthKeypair.test.ts for why this goes through `derive`.
const accountKeypair = (mnemonic: string, index: number): Keypair =>
  Keypair.fromRawEd25519Seed(
    StellarHDWallet.fromMnemonic(mnemonic).derive(`m/44'/148'/${index}'`),
  );

const accountSource = (mnemonic: string, index: number) =>
  keySource(accountKeypair(mnemonic, index));

const readData = async (res: Response) => {
  const json = (await res.json().catch(() => null)) as {
    data?: UserBody;
  } | null;
  return { status: res.status, data: json?.data };
};

const link = async (signer: Source, others: Source[]) => {
  // One clock reading for the JWT and every consent, as linkSources.ts does.
  const now = Date.now();
  const iat = issuedAtSeconds(now);
  const body = JSON.stringify({
    sources: [signer, ...others].map(({ id, kind, keypair }) => ({
      id,
      kind,
      sig: signLinkConsent({
        keypair,
        message: buildLinkConsentMessage({
          id,
          kind,
          signingSourceId: signer.id,
          iat,
        }),
      }),
    })),
  });
  const jwt = buildAuthJwt({
    keypair: signer.keypair,
    method: "POST",
    path: LINK_PATH,
    body,
    now,
  });
  return readData(
    await fetch(`${BASE_URL}${LINK_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body,
    }),
  );
};

const getUser = async (signer: Source) => {
  const jwt = buildAuthJwt({
    keypair: signer.keypair,
    method: "GET",
    path: USER_PATH,
  });
  return readData(
    await fetch(`${BASE_URL}${USER_PATH}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    }),
  );
};

const idsOf = (body?: UserBody) => (body?.sources ?? []).map(({ id }) => id);

// A link asserted to add these sources can only prove it if they start unlinked.
const expectUnlinked = async (sources: Source[]) => {
  const statuses = await Promise.all(
    sources.map(async (source) => (await getUser(source)).status),
  );
  expect(statuses).toEqual(sources.map(() => 404));
};

// Source ids are hex, so they are safe to inline into SQL.
const sql = (query: string): string =>
  execFileSync(
    "docker",
    [
      "exec",
      DB_CONTAINER!,
      "psql",
      "-U",
      "freighter",
      "-d",
      "freighter",
      "-tAc",
      query,
    ],
    { encoding: "utf8" },
  ).trim();

const ownerOf = (sourceId: string) =>
  sql(
    `SELECT u.canonical_source_id FROM user_sources s JOIN users u ON u.id = s.user_id WHERE s.source_id = '${sourceId}'`,
  );

const rowCounts = () => ({
  users: Number(sql("SELECT count(*) FROM users")),
  sources: Number(sql("SELECT count(*) FROM user_sources")),
});

d("user clusters and identity continuity (#70)", () => {
  let phraseA: string;
  let a: Source;
  let a0: Source;
  let a1: Source; // "account 2": exported and imported elsewhere
  let a2: Source; // "account 3": added after the export

  beforeAll(async () => {
    phraseA = generateMnemonic();
    a = await phraseSource(phraseA);
    [a0, a1, a2] = await Promise.all(
      [0, 1, 2].map((i) => accountSource(phraseA, i)),
    );
  });

  // Idempotent: a root never moves, so this holds on every rerun.
  it("a shipped phrase roots at the analytics id it already reports", async () => {
    const shipped = await phraseSource(SHIPPED_PHRASE);
    expect(shipped.id).toBe(SHIPPED_USER_ID);

    const res = await link(shipped, []);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(SHIPPED_USER_ID);
    expect((await getUser(shipped)).data?.userId).toBe(SHIPPED_USER_ID);
  });

  it("1. phrase A with two accounts roots a new user at A", async () => {
    await expectUnlinked([a, a0, a1]);

    const res = await link(a, [a0, a1]);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(a.id);
    expect(idsOf(res.data)).toEqual(
      expect.arrayContaining([a.id, a0.id, a1.id]),
    );
    expect(res.data?.conflicts).toEqual([]);

    const user = await getUser(a);
    expect(user.status).toBe(200);
    expect(user.data?.userId).toBe(a.id);
  });

  it("2-3. a wallet holding only account 2's exported S... resolves to A", async () => {
    // Wallet B's only source is the imported key, so it signs as that key.
    const imported = await keySource(
      Keypair.fromSecret(accountKeypair(phraseA, 1).secret()),
    );
    expect(imported.id).toBe(a1.id);

    // Before B links anything, the server already places the key in A.
    const user = await getUser(imported);
    expect(user.status).toBe(200);
    expect(user.data?.userId).toBe(a.id);

    // The import's own link call settles it as a member, not a conflict.
    const res = await link(imported, []);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(a.id);
    expect(res.data?.conflicts).toEqual([]);
  });

  it("4. a new phrase added in B joins A's cluster", async () => {
    const p = generateMnemonic();
    const pPhrase = await phraseSource(p);
    const p0 = await accountSource(p, 0);
    await expectUnlinked([pPhrase, p0]);

    // B is still pinned to the imported key, so that key signs the link.
    const res = await link(a1, [pPhrase, p0]);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(a.id);
    expect(idsOf(res.data)).toEqual(
      expect.arrayContaining([pPhrase.id, p0.id]),
    );

    // Both wallets still resolve to A.
    expect((await getUser(a)).data?.userId).toBe(a.id);
    expect((await getUser(pPhrase)).data?.userId).toBe(a.id);
  });

  it("5. a fresh phrase that imports account 2 keeps its own cluster and gets a conflict", async () => {
    const c = generateMnemonic();
    const cPhrase = await phraseSource(c);
    const c0 = await accountSource(c, 0);
    await expectUnlinked([cPhrase, c0]);

    // Onboarding C: its first link roots a new user at C.
    const created = await link(cPhrase, [c0]);
    expect(created.status).toBe(200);
    expect(created.data?.userId).toBe(cPhrase.id);

    const before = DB_CONTAINER ? rowCounts() : null;

    // Importing account 2 into C: C's pinned phrase signs, account 2 consents.
    const res = await link(cPhrase, [a1]);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(cPhrase.id);
    expect(res.data?.conflicts).toEqual([a1.id]);
    expect(idsOf(res.data)).not.toContain(a1.id);

    // The claimed key never moves, and C's `sub` still resolves to C.
    expect((await getUser(a1)).data?.userId).toBe(a.id);
    expect((await getUser(cPhrase)).data?.userId).toBe(cPhrase.id);

    if (DB_CONTAINER) {
      expect(ownerOf(a1.id)).toBe(a.id);
      // C and c0 were already linked and a1 conflicted, so nothing is written.
      expect(rowCounts()).toEqual(before);
      expect(ownerOf(c0.id)).toBe(cPhrase.id);
    }
  });

  it("6. account 3 added in A shows up for B too", async () => {
    await expectUnlinked([a2]);

    const res = await link(a, [a2]);
    expect(res.status).toBe(200);
    expect(idsOf(res.data)).toContain(a2.id);

    // B signs as the imported account 2.
    const fromB = await getUser(a1);
    expect(fromB.data?.userId).toBe(a.id);
    expect(idsOf(fromB.data)).toContain(a2.id);
  });

  it("7. two phrases and a standalone key: the key alone resolves to the same user", async () => {
    const d1 = await phraseSource(generateMnemonic());
    const d2 = await phraseSource(generateMnemonic());
    const k = await keySource(Keypair.random());
    await expectUnlinked([d1, d2, k]);

    const res = await link(d1, [d2, k]);
    expect(res.status).toBe(200);
    expect(res.data?.userId).toBe(d1.id);

    // Wallet E holds only the key.
    const user = await getUser(k);
    expect(user.status).toBe(200);
    expect(user.data?.userId).toBe(d1.id);
    expect(idsOf(user.data)).toEqual(
      expect.arrayContaining([d1.id, d2.id, k.id]),
    );

    if (DB_CONTAINER) {
      [d1, d2, k].forEach(({ id }) => expect(ownerOf(id)).toBe(d1.id));
    }
  });

  // Contract: linkWalletSources batches up to MAX_LINK_SOURCES per body
  // (userLink.ts), so the server must accept a body that size.
  it("the server accepts a full client batch of MAX_LINK_SOURCES", async () => {
    const m = generateMnemonic();
    const phrase = await phraseSource(m);
    const accounts = await Promise.all(
      Array.from({ length: MAX_LINK_SOURCES - 1 }, (_, i) =>
        accountSource(m, i),
      ),
    );

    const res = await link(phrase, accounts);
    expect(res.status).toBe(200);
    expect(idsOf(res.data)).toHaveLength(MAX_LINK_SOURCES);
  });
});
