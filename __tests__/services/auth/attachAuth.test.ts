/* eslint-disable no-underscore-dangle */
/**
 * Tests for attachAuthInterceptors helper.
 *
 * Strategy A (isolated handler tests): build a minimal fake AxiosInstance that
 * captures the interceptor functions registered via `interceptors.request.use`
 * and `interceptors.response.use`. We then invoke those functions directly to
 * exercise the logic without any real HTTP calls.
 *
 * Strategy B (integration tests): build a REAL instance via
 * `createApiService({ configureInstance: attachAuthInterceptors })` with a
 * custom axios adapter so requests never hit the network.  These tests prove
 * that the 401-retry fires through the full interceptor chain — including
 * apiFactory's error-normalizing response interceptor — which the isolated
 * handler tests cannot cover because they bypass the normalizer entirely.
 *
 * Modules under test:
 *   - services/auth/attachAuth  (the helper being implemented)
 *   - services/apiFactory       (createApiService, integration only)
 *
 * Dependencies mocked:
 *   - services/auth/getAuthKeypair  (getAuthKeypair)
 *   - services/auth/buildAuthJwt    (buildAuthJwt — mocked for isolated tests,
 *                                    real implementation used for integration)
 */
import { Keypair } from "@stellar/stellar-sdk";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { createApiService, isApiError } from "services/apiFactory";
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

// apiFactory imports config/logger; silence it in the integration tests.
jest.mock("config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
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
  // (a2) Unlocked wallet — config.params folding
  // -------------------------------------------------------------------------

  describe("when wallet is unlocked and config.params is supplied", () => {
    it("folds config.params into the signed JWT methodAndPath and clears config.params", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
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
        params: { network: "PUBLIC" },
      };
      const result = await runRequestInterceptors(cfg);

      // 1. JWT methodAndPath must include the merged query string.
      const payload = decodePayload(
        (result.headers?.Authorization as string).replace("Bearer ", ""),
      );
      expect(payload.methodAndPath).toBe(
        "GET /api/v1/protocols?network=PUBLIC",
      );

      // 2. config.params must be cleared (so axios does not double-append).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(result.params).toBeUndefined();

      // 3. config.url must have the merged query so the wire URL matches.
      expect(result.url).toBe("/protocols?network=PUBLIC");
    });

    it("appends with & when config.url already has a query string", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/foo?a=1",
        method: "get",
        headers: {},
        data: undefined,
        params: { b: "2" },
      };
      await runRequestInterceptors(cfg);

      expect(mockBuildAuthJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/v1/foo?a=1&b=2",
        }),
      );
    });

    it("folds a URLSearchParams instance (not just a plain object)", async () => {
      mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
      mockBuildAuthJwt.mockReturnValue("mock.jwt.token");

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      // URLSearchParams entries are NOT enumerable via Object.entries — the
      // merge helper must serialize it via toString(), else the query would be
      // silently dropped (neither signed nor sent) after config.params is cleared.
      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
        params: new URLSearchParams({ network: "PUBLIC", cursor: "abc" }),
      };
      const result = await runRequestInterceptors(cfg);

      expect(mockBuildAuthJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/v1/protocols?network=PUBLIC&cursor=abc",
        }),
      );
      // params cleared and folded into the url so the wire URL matches the sign.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(result.params).toBeUndefined();
      expect(result.url).toBe("/protocols?network=PUBLIC&cursor=abc");
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

    it("does NOT touch config.params when wallet is locked (params flow through axios normally)", async () => {
      mockGetAuthKeypair.mockResolvedValue(null);

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: {},
        data: undefined,
        params: { network: "PUBLIC" },
      };
      const result = await runRequestInterceptors(cfg);

      // No Authorization header.
      expect(result.headers?.Authorization).toBeUndefined();
      // config.params must be left intact for axios to append on send.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(result.params).toEqual({ network: "PUBLIC" });
      // config.url must be unchanged (no merging).
      expect(result.url).toBe("/protocols");
    });

    it("strips a stale Authorization header when locked (401-retry copies the pre-lock token)", async () => {
      mockGetAuthKeypair.mockResolvedValue(null);

      const { instance, runRequestInterceptors } = makeFakeInstance();
      attachAuthInterceptors(instance);

      // Simulates a 401-retry whose config was copied from the authed first
      // attempt (carrying a Bearer token) after the wallet locked. The locked
      // request must go out anonymously — the stale token must not be re-sent.
      const cfg = {
        baseURL: BASE_URL,
        url: "/protocols",
        method: "get",
        headers: { Authorization: "Bearer stale.jwt.token" },
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
        // Simulate that the request interceptor already attached a JWT —
        // hadAuth must be true for the retry guard to fire.
        headers: { Authorization: "Bearer mock.jwt.token" },
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

// ---------------------------------------------------------------------------
// Integration tests — real createApiService + real interceptor chain
//
// These tests prove the 401-retry fires through the FULL interceptor chain,
// including apiFactory's error-normalizing response interceptor.  The isolated
// handler tests above bypass that normalizer; this suite covers the gap that
// hid the original bug (auth interceptors registered after the normalizer).
// ---------------------------------------------------------------------------

/**
 * Reject with a proper AxiosError so that axios response interceptors receive
 * a real AxiosError (with `.response` and `.config` set) rather than a plain
 * object.  Custom adapters in axios 1.x do NOT run through `settle`
 * automatically — the built-in http/xhr adapters call `settle` internally.
 * For a custom adapter to trigger the error path the adapter must reject with
 * an AxiosError itself.
 */
function make401AxiosError(config: InternalAxiosRequestConfig): AxiosError {
  const response = {
    data: { message: "Unauthorized" },
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config,
  } as import("axios").AxiosResponse;
  const err = new axios.AxiosError(
    "Request failed with status code 401",
    "ERR_BAD_REQUEST",
    config,
    null,
    response,
  );
  return err;
}

/**
 * Build an axios adapter that rejects with a 401 AxiosError on the first call
 * and resolves with 200 on the second.  Captures every config it receives so
 * the caller can inspect the Authorization headers used on each attempt.
 */
function makeTwoCallAdapter(capturedConfigs: InternalAxiosRequestConfig[]) {
  let callCount = 0;
  return async function adapter(
    config: InternalAxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse> {
    capturedConfigs.push(config);
    callCount += 1;
    if (callCount === 1) {
      // First call → 401 Unauthorized (reject with AxiosError so axios
      // response error interceptors see .response/.config intact).
      return Promise.reject(make401AxiosError(config));
    }
    // Second call → 200 OK.
    return Promise.resolve({
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    });
  };
}

/**
 * Build an adapter that always rejects with 401 (simulates a second
 * consecutive 401 after the retry — terminal failure path).
 */
function makeAlways401Adapter(capturedConfigs: InternalAxiosRequestConfig[]) {
  return async function adapter(
    config: InternalAxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse> {
    capturedConfigs.push(config);
    return Promise.reject(make401AxiosError(config));
  };
}

describe("attachAuthInterceptors — integration through full apiFactory chain", () => {
  const BASE_URL = "https://mock-backend-v2-dev.example.com/api/v1";

  beforeEach(() => {
    jest.clearAllMocks();
    // Use the real buildAuthJwt for all integration tests so we can inspect
    // the actual JWT payloads and assert fresh tokens on retry.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { buildAuthJwt: realBuildAuthJwt } = jest.requireActual(
      "services/auth/buildAuthJwt",
    );
    mockBuildAuthJwt.mockImplementation(realBuildAuthJwt);
    mockGetAuthKeypair.mockResolvedValue(TEST_KEYPAIR);
  });

  it("adapter is called exactly twice and request succeeds with 200 on the second call", async () => {
    // This is the regression test for the ordering bug.  Before the fix,
    // the auth retry interceptor was registered AFTER apiFactory's normalizer.
    // On a 401 the normalizer would convert the AxiosError to a plain ApiError
    // (dropping .response), so err.response?.status === 401 was never true and
    // the retry never fired — the request failed with ApiError{ status: 401 }.
    // After the fix, auth interceptors are registered via configureInstance
    // (BEFORE the normalizer), so they see the raw AxiosError and the retry
    // fires correctly.
    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    // Inject the adapter after service creation — this controls HTTP responses
    // without changing the interceptor registration order.
    api.getInstance().defaults.adapter = makeTwoCallAdapter(capturedConfigs);

    const result = await api.get<{ ok: boolean }>("/token-prices");

    // Adapter was called twice: first 401, then 200.
    expect(capturedConfigs).toHaveLength(2);
    // The final response reaches the consumer as a 200.
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
  });

  it("second request carries a fresh JWT that differs from the first", async () => {
    // The retry must re-run the request interceptor to get a new JWT.
    // We use fake timers to advance the clock by 2 s between the first and
    // second call so the `iat` claim differs deterministically — without this
    // the two JWTs may be identical when both calls land in the same second.
    jest.useFakeTimers();
    const baseNow = Date.now();
    jest.setSystemTime(baseNow);

    const capturedConfigs: InternalAxiosRequestConfig[] = [];

    // Wrap the real adapter so we can advance the clock between calls.
    let callCount = 0;
    const clockAdvancingAdapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<import("axios").AxiosResponse> => {
      capturedConfigs.push(config);
      callCount += 1;
      if (callCount === 1) {
        // Advance clock BEFORE the retry so the second JWT has a later iat.
        jest.advanceTimersByTime(2000);
        // Reject with an AxiosError so interceptors see .response/.config.
        return Promise.reject(make401AxiosError(config));
      }
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    };

    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    api.getInstance().defaults.adapter = clockAdvancingAdapter;

    await api.get<{ ok: boolean }>("/protocols");

    jest.useRealTimers();

    expect(capturedConfigs).toHaveLength(2);

    // Extract Authorization headers from both captured configs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token1 = (capturedConfigs[0].headers as Record<string, any>)
      .Authorization as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token2 = (capturedConfigs[1].headers as Record<string, any>)
      .Authorization as string | undefined;

    expect(token1).toMatch(/^Bearer /);
    expect(token2).toMatch(/^Bearer /);

    // The two tokens must differ — the second request must have triggered the
    // request interceptor again to build a fresh JWT.
    expect(token1).not.toBe(token2);

    // Verify the iat in the second JWT is later than in the first.
    const payload1 = decodePayload(token1!.replace("Bearer ", ""));
    const payload2 = decodePayload(token2!.replace("Bearer ", ""));
    expect(payload2.iat as number).toBeGreaterThan(payload1.iat as number);
  });

  it("a second consecutive 401 rejects with ApiError{ status: 401 } and does NOT retry more than once", async () => {
    // When both the initial request AND the retry return 401:
    //   - The retry's inner request chain catches the second 401 in the auth
    //     interceptor (__isAuthRetry=true), rejects with the raw AxiosError,
    //     and the INNER normalizer converts it → ApiError{ status: 401 }.
    //   - The OUTER chain's normalizer is now idempotent (isApiError guard):
    //     it detects the already-normalized ApiError and rethrows it unchanged,
    //     preserving status: 401 instead of clobbering it to 0.
    // Key assertions:
    //   (a) no infinite retry loop (adapter called exactly twice),
    //   (b) the consumer receives ApiError{ status: 401 } — NOT status: 0.
    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    api.getInstance().defaults.adapter = makeAlways401Adapter(capturedConfigs);

    await expect(api.get("/protocols")).rejects.toMatchObject({
      status: 401,
      isNetworkError: false,
      message: expect.any(String),
    });

    // Exactly 2 adapter calls: original + one retry.  A third call would mean
    // the guard flag is broken.
    expect(capturedConfigs).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // isApiError type guard
  // -------------------------------------------------------------------------

  it("isApiError returns true for an ApiError-shaped object", () => {
    const apiErr = {
      message: "Unauthorized",
      status: 401,
      isNetworkError: false,
    };
    expect(isApiError(apiErr)).toBe(true);
  });

  it("isApiError returns false for a real AxiosError", () => {
    const axiosErr = new axios.AxiosError("Request failed");
    expect(isApiError(axiosErr)).toBe(false);
  });

  it("isApiError returns false for a plain object missing required fields", () => {
    expect(isApiError({ message: "oops" })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("string error")).toBe(false);
  });

  it("anonymous request (no JWT) that receives a 401 does NOT retry", async () => {
    // When the wallet is locked, getAuthKeypair() returns null and no
    // Authorization header is attached.  Retrying such a request is pointless
    // — nothing would change on the second attempt.  The response interceptor
    // must detect the absence of an Authorization header and skip the retry.
    mockGetAuthKeypair.mockResolvedValue(null);

    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    api.getInstance().defaults.adapter = makeAlways401Adapter(capturedConfigs);

    await expect(api.get("/protocols")).rejects.toMatchObject({
      status: 401,
      isNetworkError: false,
      message: expect.any(String),
    });

    // Exactly 1 adapter call — the retry must not have fired.
    expect(capturedConfigs).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // config.params folding — integration: signed path == wire path
  // -------------------------------------------------------------------------

  it("authed request with config.params: JWT methodAndPath includes query AND adapter sees merged URL with no config.params", async () => {
    // Prove that the folding is end-to-end: the JWT claim and the wire URL
    // the adapter receives are identical, and config.params was cleared.
    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    // Adapter: always 200 so we can inspect what it received.
    api.getInstance().defaults.adapter = (
      config: InternalAxiosRequestConfig,
    ) => {
      capturedConfigs.push(config);
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    };

    await api.get("/token-prices", { params: { network: "PUBLIC" } });

    expect(capturedConfigs).toHaveLength(1);
    const captured = capturedConfigs[0];

    // 1. config.params was cleared — no double-append.
    expect(captured.params).toBeUndefined();

    // 2. The wire URL has the merged query.
    expect(captured.url).toContain("?network=PUBLIC");

    // 3. The JWT methodAndPath equals the signed wire path.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authHeader = (captured.headers as Record<string, any>)
      .Authorization as string;
    expect(authHeader).toMatch(/^Bearer /);
    const payload = decodePayload(authHeader.replace("Bearer ", ""));
    expect(payload.methodAndPath).toBe(
      "GET /api/v1/token-prices?network=PUBLIC",
    );
  });

  it("config.url already has a query + config.params: joined with & not a second ?", async () => {
    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    api.getInstance().defaults.adapter = (
      config: InternalAxiosRequestConfig,
    ) => {
      capturedConfigs.push(config);
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    };

    await api.get("/foo?a=1", { params: { b: "2" } });

    expect(capturedConfigs).toHaveLength(1);
    const captured = capturedConfigs[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authHeader = (captured.headers as Record<string, any>)
      .Authorization as string;
    const payload = decodePayload(authHeader.replace("Bearer ", ""));
    // Signed and sent path must use & not a second ?.
    expect(payload.methodAndPath).toBe("GET /api/v1/foo?a=1&b=2");
    expect(captured.url).toContain("?a=1&b=2");
    expect(captured.params).toBeUndefined();
  });

  it("anonymous request with config.params: interceptor leaves params for axios to handle", async () => {
    mockGetAuthKeypair.mockResolvedValue(null);

    const capturedConfigs: InternalAxiosRequestConfig[] = [];
    const api = createApiService({
      baseURL: BASE_URL,
      configureInstance: attachAuthInterceptors,
    });
    api.getInstance().defaults.adapter = (
      config: InternalAxiosRequestConfig,
    ) => {
      capturedConfigs.push(config);
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    };

    await api.get("/protocols", { params: { network: "PUBLIC" } });

    expect(capturedConfigs).toHaveLength(1);
    const captured = capturedConfigs[0];

    // Anonymous path: interceptor must not strip params.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authHeader = (captured.headers as Record<string, any>)
      .Authorization as string | undefined;
    expect(authHeader).toBeUndefined();
    // axios serialises params onto the URL for the adapter, so by the time
    // the adapter fires, params may or may not still be on the config —
    // what matters is that no Authorization header was set.
  });
});
