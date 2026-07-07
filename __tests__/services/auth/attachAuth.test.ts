/* eslint-disable no-underscore-dangle */
/**
 * Tests for attachAuthInterceptors helper.
 *
 * Strategy: build a minimal fake AxiosInstance that captures the interceptor
 * functions registered via `interceptors.request.use` and
 * `interceptors.response.use`. We then invoke those functions directly to
 * exercise the logic without any real HTTP calls.
 *
 * Modules under test:
 *   - services/auth/attachAuth  (the helper being implemented)
 *
 * Dependencies mocked:
 *   - services/auth/getAuthKeypair  (getAuthKeypair)
 *   - services/auth/buildAuthJwt    (buildAuthJwt)
 */
import { Keypair } from "@stellar/stellar-sdk";
import { attachAuthInterceptors } from "services/auth/attachAuth";
import { buildAuthJwt } from "services/auth/buildAuthJwt";
import { getAuthKeypair } from "services/auth/getAuthKeypair";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("services/auth/getAuthKeypair", () => ({
  getAuthKeypair: jest.fn(),
}));

jest.mock("services/auth/buildAuthJwt", () => ({
  buildAuthJwt: jest.fn(),
}));

const mockGetAuthKeypair = jest.mocked(getAuthKeypair);
const mockBuildAuthJwt = jest.mocked(buildAuthJwt);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fixed test keypair — deterministic, never changes. */
const SEED = Buffer.alloc(32, 7);
const TEST_KEYPAIR = Keypair.fromRawEd25519Seed(SEED);

/** b64url → plain JSON */
const decodeSegment = (seg: string): Record<string, unknown> =>
  JSON.parse(
    Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    ),
  ) as Record<string, unknown>;

/** Decode the payload segment from a JWT string. */
const decodePayload = (jwt: string): Record<string, unknown> =>
  decodeSegment(jwt.split(".")[1]);

/**
 * Build a minimal fake AxiosInstance that records every interceptor registered
 * with it and exposes helpers for invoking them.
 */
function makeFakeInstance() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqFulfilled: Array<(cfg: any) => any> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resRejected: Array<(err: any) => any> = [];

  // Tracks calls to instance.request(...) for 401 retry assertions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestCalls: any[][] = [];

  const instance = {
    interceptors: {
      request: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        use(fulfilled: (cfg: any) => any) {
          reqFulfilled.push(fulfilled);
        },
      },
      response: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        use(_fulfilled: (res: any) => any, rejected?: (err: any) => any) {
          if (rejected) resRejected.push(rejected);
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: jest.fn((...args: any[]) => {
      requestCalls.push(args);
      return Promise.resolve({ data: "retried" });
    }),
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instance: instance as unknown as import("axios").AxiosInstance,

    /** Run all registered request interceptors in order. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async runRequestInterceptors(cfg: any): Promise<any> {
      let current = cfg;
      for (let i = 0; i < reqFulfilled.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        current = await reqFulfilled[i](current);
      }
      return current;
    },

    /** Run the first registered response error handler with an error object. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runResponseError(err: any): Promise<any> {
      if (resRejected.length === 0)
        throw new Error("No response error handler registered");
      return resRejected[0](err) as Promise<unknown>;
    },

    requestCalls,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("attachAuthInterceptors", () => {
  const BASE_URL = "https://mock-backend-v2-dev.example.com/api/v1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // (a) Unlocked wallet — Authorization header present, path includes /api/v1
  // -------------------------------------------------------------------------

  describe("when wallet is unlocked (getAuthKeypair returns a Keypair)", () => {
    it("sets Authorization: Bearer <jwt> on the config", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      // Use jest.requireActual to get the real buildAuthJwt without going
      // through the mock (which would cause an infinite loop).
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { buildAuthJwt: realBuildAuthJwt } = jest.requireActual(
        "services/auth/buildAuthJwt",
      );
      mockBuildAuthJwt.mockImplementation(realBuildAuthJwt);

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
      };
      const result = await runRequestInterceptors(cfg);

      expect(result.headers?.Authorization).toMatch(/^Bearer /);
    });

    it("builds the JWT with methodAndPath including /api/v1 prefix and query", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols?network=PUBLIC",
        method: "get",
        headers: {},
        data: undefined,
      };
      await runRequestInterceptors(cfg);

      expect(mockBuildAuthJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/v1/protocols?network=PUBLIC",
        }),
      );
    });

    it("passes method and body correctly to buildAuthJwt", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const bodyStr = '{"tokens":["XLM"]}';
      const cfg = {
        baseURL: BASE_URL,
        url: "/token-prices?network=PUBLIC",
        method: "POST",
        headers: {},
        data: bodyStr,
      };
      await runRequestInterceptors(cfg);

      expect(mockBuildAuthJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          keypair: TEST_KEYPAIR,
          method: "POST",
          path: "/api/v1/token-prices?network=PUBLIC",
          body: bodyStr,
        }),
      );
    });

    it("passes body: undefined (no hash) when config.data is not a string", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/token-prices",
        method: "post",
        headers: {},
        data: { tokens: ["XLM"] }, // object, not pre-serialized string
      };
      await runRequestInterceptors(cfg);

      expect(mockBuildAuthJwt).toHaveBeenCalledWith(
        expect.objectContaining({ body: undefined }),
      );
    });

    it("decoded JWT methodAndPath equals full path derived from baseURL + url", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      // Use jest.requireActual to get the real buildAuthJwt so we can decode the JWT.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { buildAuthJwt: realBuildAuthJwt } = jest.requireActual(
        "services/auth/buildAuthJwt",
      );
      mockBuildAuthJwt.mockImplementation(realBuildAuthJwt);

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/collectibles?network=PUBLIC",
        method: "get",
        headers: {},
        data: undefined,
      };
      const result = await runRequestInterceptors(cfg);

      const payload = decodePayload(
        (result.headers?.Authorization as string).replace("Bearer ", ""),
      );

      expect(payload.methodAndPath).toBe(
        "GET /api/v1/collectibles?network=PUBLIC",
      );
    });
  });

  // -------------------------------------------------------------------------
  // (b) Locked wallet — no Authorization header
  // -------------------------------------------------------------------------

  describe("when wallet is locked (getAuthKeypair returns null)", () => {
    it("returns config unmodified (no Authorization header)", async () => {
      mockGetAuthKeypair.mockResolvedValue(null);

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
      };
      const result = await runRequestInterceptors(cfg);

      expect(result.headers?.Authorization).toBeUndefined();
      expect(mockBuildAuthJwt).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // (c) 401 response — retry exactly once with a fresh token
  // -------------------------------------------------------------------------

  describe("on 401 response", () => {
    it("retries exactly once via instance.request with __isAuthRetry=true", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runResponseError, requestCalls } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const originalConfig = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
        __isAuthRetry: false,
      };
      const err = {
        response: { status: 401 },
        config: originalConfig,
      };

      await runResponseError(err);

      expect(requestCalls).toHaveLength(1);
      expect(requestCalls[0][0].__isAuthRetry).toBe(true);
    });

    it("does NOT retry a second time when __isAuthRetry is already true", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runResponseError, requestCalls } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const retryConfig = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
        __isAuthRetry: true, // already retried once
      };
      const err = {
        response: { status: 401 },
        config: retryConfig,
      };

      await expect(runResponseError(err)).rejects.toBe(err);
      expect(requestCalls).toHaveLength(0);
    });

    it("does NOT retry on non-401 errors", async () => {
      const { instance, runResponseError, requestCalls } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const err = {
        response: { status: 500 },
        config: { headers: {}, __isAuthRetry: false },
      };

      await expect(runResponseError(err)).rejects.toBe(err);
      expect(requestCalls).toHaveLength(0);
    });

    it("does NOT retry when error has no response (network error)", async () => {
      const { instance, runResponseError, requestCalls } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const err = {
        response: undefined,
        config: { headers: {}, __isAuthRetry: false },
      };

      await expect(runResponseError(err)).rejects.toBe(err);
      expect(requestCalls).toHaveLength(0);
    });
  });
});
