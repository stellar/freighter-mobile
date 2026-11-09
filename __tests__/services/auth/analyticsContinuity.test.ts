import { Keypair } from "@stellar/stellar-sdk";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { STORAGE_KEYS } from "config/constants";
import { Account, AUTH_STATUS } from "config/types";
import { clearSessionAuthValidMemo, useAuthenticationStore } from "ducks/auth";
import { createKeyManager } from "helpers/keyManager/keyManager";
import { ACCOUNT_SOURCE_VECTORS } from "services/auth/authKeypairVectors";
import { getAuthUserId } from "services/auth/getAuthUserId";
import { linkWalletSources } from "services/auth/linkSources";
import { getSigningIdentity } from "services/auth/signingIdentity";
import { clearCachedWalletSources } from "services/auth/walletSourcesCache";
import { dataStorage } from "services/storage/storageFactory";

/*
  #70: a wallet that existed before the upgrade keeps emitting the analytics
  id it already had, through the upgrade and everything the user does after
  it. reconcileAnalyticsUserId copies whatever getAuthUserId returns into
  METRICS_USER_ID and Amplitude (covered by reconcileUserId.test.ts), so this
  pins that value at every step.

  The auth duck, the source derivations, the linker and the request signing
  all run for real. Storage, the keystores and the temp-store cipher are
  in-memory stand-ins, and the backend is a fake that applies the server's
  root rule: the first `sub` to link roots the user, and later sources join
  the signer's user. It reads `sub` from each request's JWT, so a request
  signed by any source other than the phrase would root the user elsewhere
  and fail here, not just a wrong cached value.
*/

// The pre-upgrade METRICS_USER_ID of the fixture wallet: deriveAuthKeypair of
// its phrase, which the last single-phrase build reported. Frozen.
const PRE_UPGRADE_METRICS_USER_ID =
  "ec57e5d04783b5ade776621ab171b3b197c3acc0a1cb5bad10786dc8e381e797";

const PASSWORD = "hunter2 hunter2";
const [{ mnemonic: PHRASE, accounts: PHRASE_ACCOUNTS }] =
  ACCOUNT_SOURCE_VECTORS;
const IMPORTED_SECRET =
  "SDHOAMBNLGCE2MV5ZKIVZAQD3VCLGP53P3OBSBI6UN5L5XZI5TKHFQL4";
const IMPORTED_PUBLIC_KEY = Keypair.fromSecret(IMPORTED_SECRET).publicKey();

/*
  A pre-V2 install, as the last single-phrase build left it: accounts with no
  `sourceId`, every keystore (the import's too) stamped with the phrase, and
  no SECRET_SOURCES, PINNED_SOURCE_ID or DERIVATION_INDICES. Phrase index 0
  is active, index 1 is the second account, and the third is an imported key.
*/
const PRE_V2_ACCOUNTS: Account[] = [
  {
    id: "derived-0",
    name: "Account 1",
    publicKey: PHRASE_ACCOUNTS[0].publicKey,
  },
  {
    id: "derived-1",
    name: "Account 2",
    publicKey: PHRASE_ACCOUNTS[1].publicKey,
  },
  {
    id: "imported",
    name: "Account 3",
    publicKey: IMPORTED_PUBLIC_KEY,
    importedFromSecretKey: true,
  },
];

// The factories below run while the imports above load, before this file's
// own consts exist, so each keeps its state inside and exports it.
jest.mock("services/storage/storageFactory", () => {
  const memoryStore = () => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (key: string) => Promise.resolve(map.get(key) ?? null),
      setItem: (key: string, value: string) => {
        map.set(key, value);
        return Promise.resolve();
      },
      remove: (keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => map.delete(key));
        return Promise.resolve();
      },
      clear: () => {
        map.clear();
        return Promise.resolve();
      },
      checkIfExists: (key: string) => Promise.resolve(map.has(key)),
    };
  };
  return {
    dataStorage: memoryStore(),
    secureDataStorage: memoryStore(),
    biometricDataStorage: memoryStore(),
  };
});

// Keystores keyed by id. loadKey rejects a wrong password like the real one.
jest.mock("helpers/keyManager/keyManager", () => {
  const keys = new Map<string, { key: object; password: string }>();
  let nextId = 0;
  const keyManager = {
    keys,
    storeKey: ({ key, password }: { key: object; password: string }) => {
      nextId += 1;
      const id = `added-${nextId}`;
      keys.set(id, { key: { ...key, id }, password });
      return Promise.resolve({ id });
    },
    loadKey: (id: string, password: string) => {
      const entry = keys.get(id);
      return entry && entry.password === password
        ? Promise.resolve(entry.key)
        : Promise.reject(new Error("Invalid password"));
    },
    loadAllKeyIds: () => Promise.resolve([...keys.keys()]),
    removeKey: (id: string) => {
      keys.delete(id);
      return Promise.resolve();
    },
  };
  return { createKeyManager: () => keyManager };
});

const storedKeys = (
  createKeyManager("") as unknown as {
    keys: Map<string, { key: object; password: string }>;
  }
).keys;

// The temp store's cipher is not under test; a pass-through keeps the session
// readable without the KDF.
jest.mock("helpers/encryptPassword", () => ({
  generateSalt: jest.fn(() => "salt"),
  deriveKeyFromPassword: jest.fn(() => Promise.resolve(new Uint8Array(32))),
  encryptDataWithDerivedKey: jest.fn((data: string) => data),
  decryptDataWithDerivedKey: jest.fn((data: string) => data),
}));

// getKeypair cannot run under Jest (see deriveAuthKeypair.test.ts), so the
// account keys come from the committed vectors.
jest.mock("stellar-hd-wallet", () => {
  const { ACCOUNT_SOURCE_VECTORS: vectors } = jest.requireActual(
    "services/auth/authKeypairVectors",
  );
  return {
    __esModule: true,
    default: {
      fromMnemonic: (mnemonic: string) => {
        const rows = (vectors as typeof ACCOUNT_SOURCE_VECTORS).find(
          (vector) => vector.mnemonic === mnemonic,
        )!.accounts;
        return {
          getPublicKey: (index: number) => rows[index]?.publicKey,
          getSecret: (index: number) => rows[index]?.secret,
        };
      },
    },
  };
});

/*
  The fake backend. freighterBackendV2 is the real auth-wired api service, so
  every request goes through attachAuth and carries the JWT the app would
  send; only the transport is replaced.
*/
const subOf = (authorization: unknown): string | null => {
  if (typeof authorization !== "string") {
    return null;
  }
  const payload = authorization.split(" ")[1].split(".")[1];
  return (
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub: string;
    }
  ).sub;
};

const makeFakeBackend = () => {
  const owner = new Map<string, string>(); // source id -> root
  const kinds = new Map<string, string>();
  const signers: string[] = [];

  const cluster = (root: string) =>
    [...owner]
      .filter(([, r]) => r === root)
      .map(([id]) => ({ id, kind: kinds.get(id) }));

  const respond = (
    config: InternalAxiosRequestConfig,
    status: number,
    data?: object,
  ) => {
    const response = {
      data: data ? { data } : null,
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (status >= 400) {
      return Promise.reject(
        new AxiosError(
          `Request failed with status code ${status}`,
          AxiosError.ERR_BAD_REQUEST,
          config,
          null,
          response,
        ),
      );
    }
    return Promise.resolve(response);
  };

  const adapter = (config: InternalAxiosRequestConfig) => {
    const sub = subOf(config.headers?.Authorization);
    if (!sub) {
      return respond(config, 401);
    }
    signers.push(sub);

    if (config.url === "/user/link" && config.method === "post") {
      const { sources } = JSON.parse(String(config.data)) as {
        sources: { id: string; kind: string }[];
      };
      const root = owner.get(sub) ?? sub;
      const conflicts: string[] = [];
      sources.forEach(({ id, kind }) => {
        const current = owner.get(id);
        if (!current) {
          owner.set(id, root);
          kinds.set(id, kind);
        } else if (current !== root) {
          conflicts.push(id);
        }
      });
      return respond(config, 200, {
        userId: root,
        sources: cluster(root),
        conflicts,
      });
    }

    if (config.url === "/user") {
      const root = owner.get(sub);
      return root
        ? respond(config, 200, { userId: root, sources: cluster(root) })
        : respond(config, 404);
    }
    return respond(config, 404);
  };

  return { adapter, owner, signers, cluster };
};

const mockBackend = makeFakeBackend();

jest.mock("services/backend", () => {
  const { createApiService } = jest.requireActual("services/apiFactory");
  const { attachAuthInterceptors } = jest.requireActual(
    "services/auth/attachAuth",
  );
  return {
    freighterBackendV2: createApiService({
      baseURL: "https://backend.test/api/v1",
      configureInstance: (instance: import("axios").AxiosInstance) => {
        attachAuthInterceptors(instance);
        // eslint-disable-next-line no-param-reassign
        instance.defaults.adapter = mockBackend.adapter;
      },
    }),
  };
});

// The rest of the duck's collaborators: nothing here depends on them.
jest.mock("services/stellar", () => ({ getAccount: jest.fn() }));
jest.mock("i18next", () => ({ t: (key: string) => key }));
jest.mock("ducks/walletKit", () => ({
  useWalletKitStore: {
    getState: jest.fn(() => ({ disconnectAllSessions: jest.fn() })),
  },
}));
jest.mock("helpers/walletKitUtil", () => ({
  clearWalletKitStorage: jest.fn(),
}));
jest.mock("helpers/browser", () => ({ clearAllWebViewData: jest.fn() }));
jest.mock("helpers/screenshotCrypto", () => ({
  clearScreenshotDek: jest.fn(),
}));
jest.mock("ducks/browserTabs", () => ({
  useBrowserTabsStore: {
    getState: jest.fn(() => ({ closeAllTabs: jest.fn() })),
  },
}));
jest.mock("ducks/balances", () => ({
  useBalancesStore: {
    getState: jest.fn(() => ({ fetchBalances: jest.fn() })),
    setState: jest.fn(),
  },
}));
jest.mock("ducks/history", () => ({
  useHistoryStore: {
    getState: jest.fn(() => ({ fetchHistory: jest.fn() })),
    setState: jest.fn(),
  },
}));
jest.mock("ducks/collectibles", () => ({
  useCollectiblesStore: { setState: jest.fn() },
}));
jest.mock("ducks/prices", () => ({
  usePricesStore: {
    getState: jest.fn(() => ({ fetchPrices: jest.fn() })),
    setState: jest.fn(),
  },
}));
jest.mock("ducks/accountsFiatTotals", () => ({
  useAccountsFiatTotalsStore: {
    getState: jest.fn(() => ({ resetAccountsFiatTotals: jest.fn() })),
  },
}));

const store = () => useAuthenticationStore.getState();

// Triggers start the linker without awaiting it. A call while it runs joins
// that run and queues one more pass, so this settles every pending link.
const settleLinks = () => linkWalletSources();

// Every step's id check would still pass after a failed step, since the id is
// cached, so each step must also leave the session unlocked and error-free.
const expectHealthy = () => {
  expect(store().error).toBeNull();
  expect(store().authStatus).toBe(AUTH_STATUS.AUTHENTICATED);
};

// Once the server's id is cached, getAuthUserId returns it without reading
// the session, locked or not. So also check the session: unlocked, it must
// sign as the pinned phrase; locked, it must hold no signer.
const expectSameId = async ({ unlocked }: { unlocked: boolean }) => {
  expect(await getAuthUserId()).toEqual({
    analyticsUserId: PRE_UPGRADE_METRICS_USER_ID,
    isConfirmed: true,
  });
  expect(await dataStorage.getItem(STORAGE_KEYS.PINNED_SOURCE_ID)).toBe(
    PRE_UPGRADE_METRICS_USER_ID,
  );
  const identity = await getSigningIdentity();
  if (unlocked) {
    expect(identity?.sourceId).toBe(PRE_UPGRADE_METRICS_USER_ID);
  } else {
    expect(identity).toBeNull();
  }
};

// A relaunch drops everything held in memory and reads the status back from
// storage, the way the app does on a cold start.
const relaunch = async () => {
  clearCachedWalletSources();
  clearSessionAuthValidMemo();
  useAuthenticationStore.setState({
    authStatus: await store().getAuthStatus(),
  });
};

describe("analytics id continuity after an upgrade (#70)", () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    await dataStorage.setItem(
      STORAGE_KEYS.ACCOUNT_LIST,
      JSON.stringify(PRE_V2_ACCOUNTS),
    );
    await dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, "derived-0");
    PRE_V2_ACCOUNTS.forEach(({ id, publicKey }, index) => {
      const privateKey =
        id === "imported" ? IMPORTED_SECRET : PHRASE_ACCOUNTS[index].secret;
      storedKeys.set(id, {
        key: {
          id,
          publicKey,
          privateKey,
          extra: { imported: id === "imported", mnemonicPhrase: PHRASE },
        },
        password: PASSWORD,
      });
    });
  });

  it("holds no id after the update, so the stored one stays in place", async () => {
    // A cold start with no session: the password must be entered again.
    await relaunch();
    expect(store().authStatus).toBe(AUTH_STATUS.HASH_KEY_EXPIRED);

    // reconcileAnalyticsUserId ignores a null id: the pre-upgrade
    // METRICS_USER_ID stays in place until the first unlock.
    expect(await getAuthUserId()).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
  });

  it("keeps the id through the first unlock and its first link", async () => {
    await store().signIn({ password: PASSWORD });
    await settleLinks();
    expectHealthy();

    await expectSameId({ unlocked: true });
    // The phrase rooted the user, so the server's id is the old id.
    expect(mockBackend.owner.get(PRE_UPGRADE_METRICS_USER_ID)).toBe(
      PRE_UPGRADE_METRICS_USER_ID,
    );
    expect(await dataStorage.getItem(STORAGE_KEYS.CANONICAL_USER_ID)).toBe(
      PRE_UPGRADE_METRICS_USER_ID,
    );
  });

  it("keeps the id when an account is added", async () => {
    await store().createAccount(PASSWORD);
    await settleLinks();
    expectHealthy();
    await expectSameId({ unlocked: true });
  });

  it("keeps the id when a secret key is imported", async () => {
    await store().importSecretKey({
      secretKey: Keypair.random().secret(),
      password: PASSWORD,
    });
    await settleLinks();
    expectHealthy();
    await expectSameId({ unlocked: true });
  });

  it("keeps the id with the imported account active", async () => {
    await store().selectAccount(IMPORTED_PUBLIC_KEY);
    expectHealthy();
    expect(store().account?.publicKey).toBe(IMPORTED_PUBLIC_KEY);
    await expectSameId({ unlocked: true });
  });

  it("keeps the id while locked", async () => {
    await store().softLock();
    // isSessionAuthValid memoizes its answer briefly; read past it.
    clearSessionAuthValidMemo();
    await expectSameId({ unlocked: false });
  });

  it("keeps the id across a relaunch and the unlock after it", async () => {
    await relaunch();
    expect(store().authStatus).toBe(AUTH_STATUS.LOCKED);
    await expectSameId({ unlocked: false });

    await store().signIn({ password: PASSWORD });
    await settleLinks();
    expectHealthy();
    await expectSameId({ unlocked: true });
  });

  it("signed every request as the phrase, and every source joined its user", () => {
    expect(new Set(mockBackend.signers)).toEqual(
      new Set([PRE_UPGRADE_METRICS_USER_ID]),
    );
    // One user, and every source the wallet holds is in it.
    expect(new Set(mockBackend.owner.values())).toEqual(
      new Set([PRE_UPGRADE_METRICS_USER_ID]),
    );
    const kinds = mockBackend
      .cluster(PRE_UPGRADE_METRICS_USER_ID)
      .map(({ kind }) => kind);
    // The phrase, its three derived accounts, and two imported keys.
    expect(kinds.filter((k) => k === "phrase")).toHaveLength(1);
    expect(kinds.filter((k) => k === "secret_key")).toHaveLength(5);
  });
});
