import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { ApiError } from "services/apiFactory";
import { getAuthUserId } from "services/auth/getAuthUserId";
import { clearLinkStatus } from "services/auth/linkStatus";
import { getSigningIdentity } from "services/auth/signingIdentity";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
// Mock only the immediate dependency: getSigningIdentity does its own
// thorough resolution testing in signingIdentity.test.ts.
jest.mock("services/auth/signingIdentity", () => ({
  getSigningIdentity: jest.fn(),
}));
// Minimal in-memory dataStorage, as in linkStatus.test.ts.
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

const PINNED = "a".repeat(64);
const ROOT = "b".repeat(64);
const FALLBACK = "c".repeat(64);

const apiError = (status: number, isNetworkError = false): ApiError => ({
  message: "Request failed",
  status,
  isNetworkError,
});

const makeApi = (get: jest.Mock) => ({ get });

const userResponse = (userId: string) => ({
  data: { data: { userId, sources: [{ id: userId, kind: "mnemonic" }] } },
  status: 200,
  statusText: "OK",
});

const storedUserId = (): string | undefined =>
  memory[STORAGE_KEYS.CANONICAL_USER_ID];

describe("getAuthUserId", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearLinkStatus();
    memory[STORAGE_KEYS.PINNED_SOURCE_ID] = PINNED;
    mockGetSigningIdentity.mockResolvedValue({
      sourceId: PINNED,
      keypair: { SECRET: "priv" },
    });
  });

  it("returns the cached id without a signer or a request, as when locked", async () => {
    memory[STORAGE_KEYS.CANONICAL_USER_ID] = ROOT;
    mockGetSigningIdentity.mockResolvedValue(null);
    const get = jest.fn();

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: ROOT,
      isConfirmed: true,
    });
    expect(mockGetSigningIdentity).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("returns null when locked with nothing cached", async () => {
    mockGetSigningIdentity.mockResolvedValue(null);
    const get = jest.fn();

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("asks GET /user and caches the canonical id", async () => {
    const get = jest.fn().mockResolvedValue(userResponse(ROOT));

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: ROOT,
      isConfirmed: true,
    });
    expect(get).toHaveBeenCalledWith("/user");
    expect(storedUserId()).toBe(ROOT);

    // The next call is served from the cache.
    await getAuthUserId({ api: makeApi(get) });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("returns the pinned id, unconfirmed and uncached, before the first link", async () => {
    const get = jest.fn().mockRejectedValue(apiError(404));

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: PINNED,
      isConfirmed: false,
    });
    expect(storedUserId()).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("falls back to the pinned id when offline or on a server error", async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(apiError(0, true))
      .mockRejectedValueOnce(apiError(503));

    for (let i = 0; i < 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
        analyticsUserId: PINNED,
        isConfirmed: false,
      });
    }
    expect(storedUserId()).toBeUndefined();
    // Only the server error is logged.
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("ignores a 200 without a user id", async () => {
    const get = jest.fn().mockResolvedValue({ data: { userId: ROOT } });

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: PINNED,
      isConfirmed: false,
    });
    expect(storedUserId()).toBeUndefined();
  });

  it.each([
    ["an empty string", ""],
    ["a non-hex string", "not-a-source-id"],
    ["uppercase hex", "B".repeat(64)],
    ["a short hex id", "b".repeat(63)],
    ["a long hex id", "b".repeat(65)],
    ["a number", 42],
  ])("ignores a 200 whose user id is %s", async (_label, userId) => {
    const get = jest.fn().mockResolvedValue({
      data: { data: { userId } },
      status: 200,
      statusText: "OK",
    });

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: PINNED,
      isConfirmed: false,
    });
    expect(storedUserId()).toBeUndefined();
  });

  it("drops the answer when the wallet is replaced mid-request", async () => {
    const get = jest.fn(async () => {
      await clearLinkStatus();
      return userResponse(ROOT);
    });

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
    expect(storedUserId()).toBeUndefined();
  });

  it("returns no id when the wallet is replaced while the cached id is read", async () => {
    memory[STORAGE_KEYS.CANONICAL_USER_ID] = ROOT;
    // The read lands before the remove clearLinkStatus queues after it.
    (dataStorage.getItem as jest.Mock).mockImplementationOnce(
      async (key: string) => {
        const value = memory[key] ?? null;
        await clearLinkStatus();
        return value;
      },
    );
    const get = jest.fn();

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("drops the answer when the wallet is replaced while it is cached", async () => {
    const get = jest.fn().mockResolvedValue(userResponse(ROOT));
    // The write lands, then the replacement starts before setItem returns.
    (dataStorage.setItem as jest.Mock).mockImplementationOnce(
      async (key: string, value: string) => {
        memory[key] = value;
        await clearLinkStatus();
      },
    );

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
    expect(storedUserId()).toBeUndefined();
  });

  it("returns no id when the wallet is replaced during a 404", async () => {
    const get = jest.fn(async () => {
      await clearLinkStatus();
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw apiError(404);
    });

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
  });

  it("skips GET /user when the signer is a fallback, not the pin", async () => {
    // The pin didn't derive this unlock; the resolver signs as another
    // held source, whose user may be someone else's.
    mockGetSigningIdentity.mockResolvedValue({
      sourceId: FALLBACK,
      keypair: { SECRET: "priv" },
    });
    const get = jest.fn().mockResolvedValue(userResponse(ROOT));

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: PINNED,
      isConfirmed: false,
    });
    expect(get).not.toHaveBeenCalled();
    expect(storedUserId()).toBeUndefined();
  });

  it("skips GET /user when no pin is stored", async () => {
    delete memory[STORAGE_KEYS.PINNED_SOURCE_ID];
    const get = jest.fn().mockResolvedValue(userResponse(ROOT));

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: PINNED,
      isConfirmed: false,
    });
    expect(get).not.toHaveBeenCalled();
    expect(storedUserId()).toBeUndefined();
  });

  it("returns no id when the wallet is replaced while the pin is read", async () => {
    mockGetSigningIdentity.mockResolvedValue({
      sourceId: FALLBACK,
      keypair: { SECRET: "priv" },
    });
    // getItem is called for the cached id first, then the pin.
    (dataStorage.getItem as jest.Mock)
      .mockImplementationOnce((key: string) =>
        Promise.resolve(memory[key] ?? null),
      )
      .mockImplementationOnce(async (key: string) => {
        const value = memory[key] ?? null;
        await clearLinkStatus();
        return value;
      });
    const get = jest.fn();

    expect(await getAuthUserId({ api: makeApi(get) })).toEqual({
      analyticsUserId: null,
      isConfirmed: false,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("never returns keypair/private material", async () => {
    const get = jest.fn().mockRejectedValue(apiError(404));

    const result = await getAuthUserId({ api: makeApi(get) });

    expect(JSON.stringify(result)).not.toContain("priv");
  });
});
