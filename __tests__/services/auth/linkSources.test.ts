import { Keypair, xdr } from "@stellar/stellar-sdk";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { SecretSourceType } from "config/types";
import { createApiService } from "services/apiFactory";
import { attachAuthInterceptors } from "services/auth/attachAuth";
import { linkWalletSources } from "services/auth/linkSources";
import { clearLinkStatus } from "services/auth/linkStatus";
import { getSigningIdentity } from "services/auth/signingIdentity";
import {
  buildLinkConsentMessage,
  MAX_LINK_SOURCES,
  UserLinkBody,
} from "services/auth/userLinkConsent";
import { getWalletSources, WalletSource } from "services/auth/walletSources";

jest.mock("config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("services/auth/signingIdentity", () => ({
  getSigningIdentity: jest.fn(),
}));
jest.mock("services/auth/walletSources", () => ({
  getWalletSources: jest.fn(),
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
      remove: jest.fn((keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          delete memory[key];
        });
        return Promise.resolve();
      }),
    },
  };
});

const { __memory: memory } = jest.requireMock<{
  __memory: Record<string, string>;
}>("services/storage/storageFactory");

const mockGetSigningIdentity = getSigningIdentity as jest.Mock;
const mockGetWalletSources = getWalletSources as jest.Mock;

const BASE_URL = "https://be.example.test/api/v1";
const NOW = 1_761_000_000_500;

const storedUserId = (): string | undefined =>
  memory[STORAGE_KEYS.CANONICAL_USER_ID];

const storedMap = (): Record<string, string> | undefined =>
  memory[STORAGE_KEYS.SOURCE_LINK_STATUS]
    ? JSON.parse(memory[STORAGE_KEYS.SOURCE_LINK_STATUS])
    : undefined;

const makeSource = (kind = SecretSourceType.SECRET_KEY) => {
  const keypair = Keypair.random();
  return {
    source: { id: xdr.encodeBytes(keypair.rawPublicKey(), "hex"), kind },
    keypair,
  };
};

/*
  A wallet whose first source is the pinned phrase. `add` holds one more
  source, as a derive or an import would.
*/
const makeWallet = (extra: number) => {
  const pinned = makeSource(SecretSourceType.PHRASE);
  const sources: WalletSource[] = [pinned.source];
  const signers = new Map<string, Keypair>([
    [pinned.source.id, pinned.keypair],
  ]);
  const add = () => {
    const next = makeSource();
    sources.push(next.source);
    signers.set(next.source.id, next.keypair);
    return next.source.id;
  };
  for (let i = 0; i < extra; i += 1) {
    add();
  }
  const identity = { sourceId: pinned.source.id, keypair: pinned.keypair };
  memory[STORAGE_KEYS.PINNED_SOURCE_ID] = pinned.source.id;
  mockGetSigningIdentity.mockResolvedValue(identity);
  mockGetWalletSources.mockImplementation(() =>
    Promise.resolve({ sources: [...sources], signers }),
  );
  return { sub: pinned.source.id, ids: () => sources.map(({ id }) => id), add };
};

type Responder = (
  config: InternalAxiosRequestConfig,
) => Promise<AxiosResponse> | AxiosResponse;

const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

const fail = (config: InternalAxiosRequestConfig, status: number) =>
  Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      "ERR_BAD_RESPONSE",
      config,
      {},
      { data: {}, status, statusText: "", headers: {}, config },
    ),
  );

const sentIds = (config: InternalAxiosRequestConfig): string[] =>
  (JSON.parse(config.data as string) as UserLinkBody).sources.map(
    ({ id }) => id,
  );

/* A server that puts every sent source in the caller's cluster except `foreign`. */
const server =
  (foreign: string[] = []): Responder =>
  (config) => {
    const ids = sentIds(config);
    return ok(config, {
      data: {
        userId: ids[0],
        sources: ids
          .filter((id) => !foreign.includes(id))
          .map((id) => ({ id, kind: "secret_key" })),
        conflicts: ids.filter((id) => foreign.includes(id)),
      },
    });
  };

/* A real auth-wired instance whose adapter records every request. */
const makeApi = (respond: Responder) => {
  const calls: InternalAxiosRequestConfig[] = [];
  const api = createApiService({
    baseURL: BASE_URL,
    configureInstance: attachAuthInterceptors,
  });
  api.getInstance().defaults.adapter = async (config) => {
    calls.push(config);
    return respond(config);
  };
  return { api, calls };
};

const decodeSegment = (seg: string) =>
  JSON.parse(
    Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    ),
  ) as Record<string, unknown>;

const jwtIat = (config: InternalAxiosRequestConfig): number => {
  const auth = (config.headers as Record<string, string>).Authorization;
  return decodeSegment(auth.replace("Bearer ", "").split(".")[1]).iat as number;
};

/* Every consent in the call verifies under `sub` and `iat`. */
const expectConsentsVerify = (
  config: InternalAxiosRequestConfig,
  wallet: { sub: string },
  iat: number,
) => {
  const body = JSON.parse(config.data as string) as UserLinkBody;
  body.sources.forEach(({ id, kind, sig }) => {
    const message = buildLinkConsentMessage({
      id,
      kind,
      signingSourceId: wallet.sub,
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

/* A promise and the function that resolves it. */
const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("linkWalletSources", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearLinkStatus();
  });

  it("links every held source in one call and stores each as linked", async () => {
    const wallet = makeWallet(2);
    const { api, calls } = makeApi(server());

    await linkWalletSources({ api, clock: () => NOW });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("post");
    expect(api.getInstance().getUri(calls[0])).toBe(`${BASE_URL}/user/link`);
    expect(sentIds(calls[0])).toEqual(wallet.ids());
    expect(jwtIat(calls[0])).toBe(Math.floor(NOW / 1000));
    expectConsentsVerify(calls[0], wallet, jwtIat(calls[0]));
    expect(storedMap()).toEqual(
      Object.fromEntries(wallet.ids().map((id) => [id, "linked"])),
    );
    expect(logger.error).not.toHaveBeenCalled();
    // The analytics id (#69) comes from the response's userId.
    expect(storedUserId()).toBe(wallet.sub);
  });

  it("caches the existing user's id when the wallet resolved to one", async () => {
    makeWallet(1);
    memory[STORAGE_KEYS.CANONICAL_USER_ID] = "stale";
    const root = "f".repeat(64);
    const inner = server();
    const { api } = makeApi(async (config) => {
      const res = await inner(config);
      return { ...res, data: { data: { ...res.data.data, userId: root } } };
    });

    await linkWalletSources({ api });

    expect(storedUserId()).toBe(root);
  });

  it("caches no id when the call fails", async () => {
    makeWallet(1);
    const { api } = makeApi((config) => fail(config, 500));

    await linkWalletSources({ api });

    expect(storedUserId()).toBeUndefined();
  });

  it.each([
    ["an empty body", null],
    ["no data envelope", { sources: [], conflicts: [] }],
    ["no sources list", { data: { conflicts: [] } }],
    ["no conflicts list", { data: { sources: [] } }],
    ["sources that is not a list", { data: { sources: {}, conflicts: [] } }],
  ])(
    "alerts on %s, stores nothing and stops the pass",
    async (_label, data) => {
      const wallet = makeWallet(MAX_LINK_SOURCES + 10);
      const malformed = makeApi((config) => ok(config, data));

      await linkWalletSources({ api: malformed.api });

      expect(malformed.calls).toHaveLength(1);
      expect(storedMap()).toBeUndefined();
      expect(storedUserId()).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        "linkWalletSources",
        "Malformed /user/link response",
        expect.any(Error),
      );

      const online = makeApi(server());
      await linkWalletSources({ api: online.api });
      expect(sentIds(online.calls[0])[0]).toBe(wallet.sub);
      expect(Object.keys(storedMap()!)).toHaveLength(wallet.ids().length);
    },
  );

  it("alerts on a source the server reports neither way and resends it", async () => {
    const wallet = makeWallet(2);
    const [, , dropped] = wallet.ids();
    const inner = server();
    const { api } = makeApi((config) => {
      const response = inner(config) as AxiosResponse<{
        data: { sources: { id: string }[] };
      }>;
      response.data.data.sources = response.data.data.sources.filter(
        ({ id }) => id !== dropped,
      );
      return response;
    });

    await linkWalletSources({ api });

    expect(logger.error).toHaveBeenCalledWith(
      "linkWalletSources",
      "Malformed /user/link response",
      expect.any(Error),
    );
    expect(Object.keys(storedMap()!)).toEqual(
      wallet.ids().filter((id) => id !== dropped),
    );

    const next = makeApi(server());
    await linkWalletSources({ api: next.api });
    expect(sentIds(next.calls[0])).toEqual([wallet.sub, dropped]);
  });

  it("sends nothing once every source is settled", async () => {
    makeWallet(2);
    const { api, calls } = makeApi(server());

    await linkWalletSources({ api });
    await linkWalletSources({ api });

    expect(calls).toHaveLength(1);
  });

  it("stores nothing when offline, and the next run sends the same sources", async () => {
    const wallet = makeWallet(1);
    const offline = makeApi((config) =>
      Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config)),
    );

    await linkWalletSources({ api: offline.api });
    expect(storedMap()).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();

    const online = makeApi(server());
    await linkWalletSources({ api: online.api });
    expect(sentIds(online.calls[0])).toEqual(wallet.ids());
  });

  it("sends only the pinned source and the new one after an add", async () => {
    const wallet = makeWallet(2);
    const { api, calls } = makeApi(server());
    await linkWalletSources({ api });

    const added = wallet.add();
    await linkWalletSources({ api });

    expect(calls).toHaveLength(2);
    expect(sentIds(calls[1])).toEqual([wallet.sub, added]);
    expect(Object.keys(storedMap()!)).toHaveLength(4);
  });

  it("stores a conflict and does not send it again", async () => {
    const wallet = makeWallet(0);
    const foreign = wallet.add();
    const { api, calls } = makeApi(server([foreign]));

    await linkWalletSources({ api });
    expect(storedMap()).toEqual({
      [wallet.sub]: "linked",
      [foreign]: "conflict",
    });

    await linkWalletSources({ api });
    expect(calls).toHaveLength(1);
  });

  it("does not retry a 401 in place and stores nothing", async () => {
    makeWallet(1);
    const { api, calls } = makeApi((config) => fail(config, 401));

    await linkWalletSources({ api });

    expect(calls).toHaveLength(1);
    expect(storedMap()).toBeUndefined();
  });

  it("sends nothing when the session holds no signer", async () => {
    mockGetSigningIdentity.mockResolvedValue(null);
    const { api, calls } = makeApi(server());

    await linkWalletSources({ api });

    expect(calls).toHaveLength(0);
  });

  it("sends nothing when the signer is not the pin, and links on the next run once it is", async () => {
    const wallet = makeWallet(1);
    // The pin did not derive this unlock: getSigningIdentity fell back to
    // another held source.
    memory[STORAGE_KEYS.PINNED_SOURCE_ID] = "a".repeat(64);
    const { api, calls } = makeApi(server());

    await linkWalletSources({ api });
    expect(calls).toHaveLength(0);
    expect(storedMap()).toBeUndefined();

    memory[STORAGE_KEYS.PINNED_SOURCE_ID] = wallet.sub;
    await linkWalletSources({ api });
    expect(sentIds(calls[0])).toEqual(wallet.ids());
  });

  it("coalesces overlapping calls into one request plus one rerun", async () => {
    const wallet = makeWallet(1);
    const gate = deferred();
    const firstSent = deferred();
    const inner = server();
    let count = 0;
    const { api, calls } = makeApi(async (config) => {
      count += 1;
      if (count === 1) {
        firstSent.resolve();
        await gate.promise;
      }
      return inner(config);
    });

    const first = linkWalletSources({ api });
    await firstSent.promise;
    // A source add and an unlock both land while the first request is out.
    const added = wallet.add();
    const second = linkWalletSources({ api });
    const third = linkWalletSources({ api });
    gate.resolve();
    await Promise.all([first, second, third]);

    expect(calls).toHaveLength(2);
    expect(sentIds(calls[1])).toEqual([wallet.sub, added]);
  });

  it("splits a large wallet into bodies that each start with sub", async () => {
    const wallet = makeWallet(MAX_LINK_SOURCES + 10);
    const { api, calls } = makeApi(server());

    await linkWalletSources({ api, clock: () => NOW });

    expect(calls).toHaveLength(2);
    calls.forEach((config) => {
      expect(sentIds(config)[0]).toBe(wallet.sub);
      expect(jwtIat(config)).toBe(Math.floor(NOW / 1000));
    });
    expect(Object.keys(storedMap()!)).toHaveLength(wallet.ids().length);
  });

  it("signs each body under a fresh iat when an earlier call is slow", async () => {
    const wallet = makeWallet(MAX_LINK_SOURCES + 10);
    const inner = server();
    let time = NOW;
    const { api, calls } = makeApi((config) => {
      // The first response outlives the 15-second JWT.
      time += 16_000;
      return inner(config);
    });

    await linkWalletSources({ api, clock: () => time });

    expect(calls).toHaveLength(2);
    const [first, second] = calls;
    expect(jwtIat(first)).toBe(Math.floor(NOW / 1000));
    expect(jwtIat(second)).toBe(Math.floor((NOW + 16_000) / 1000));
    expectConsentsVerify(second, wallet, jwtIat(second));
    expect(Object.keys(storedMap()!)).toHaveLength(wallet.ids().length);
  });

  it("stops at the first failed body and leaves the rest unsettled", async () => {
    const wallet = makeWallet(MAX_LINK_SOURCES + 10);
    const inner = server();
    let count = 0;
    const { api, calls } = makeApi((config) => {
      count += 1;
      return count === 1 ? inner(config) : fail(config, 500);
    });

    await linkWalletSources({ api });

    expect(calls).toHaveLength(2);
    expect(Object.keys(storedMap()!)).toHaveLength(MAX_LINK_SOURCES);
    expect(wallet.ids().length).toBeGreaterThan(MAX_LINK_SOURCES);
  });

  it("drops a response that lands after the wallet was replaced", async () => {
    makeWallet(1);
    const gate = deferred();
    const firstSent = deferred();
    const inner = server();
    const { api, calls } = makeApi(async (config) => {
      firstSent.resolve();
      await gate.promise;
      return inner(config);
    });

    const pass = linkWalletSources({ api });
    await firstSent.promise;
    // A sign up over the wallet, an import or a wipe clears the map while
    // the request is out.
    await clearLinkStatus();
    gate.resolve();
    await pass;

    expect(calls).toHaveLength(1);
    expect(storedMap()).toBeUndefined();
    expect(storedUserId()).toBeUndefined();
  });

  it("sends no further body once the wallet is replaced mid-pass", async () => {
    makeWallet(MAX_LINK_SOURCES + 10);
    const inner = server();
    const { api, calls } = makeApi(async (config) => {
      const res = await inner(config);
      if (calls.length === 1) {
        await clearLinkStatus();
      }
      return res;
    });

    await linkWalletSources({ api });

    expect(calls).toHaveLength(1);
    expect(storedMap()).toBeUndefined();
  });
});
