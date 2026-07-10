/* eslint-disable no-underscore-dangle */
/**
 * attachAuth — wire per-request JWT auth onto an AxiosInstance.
 *
 * Adds two additive interceptors to the given instance:
 *
 * 1. **Request interceptor**: builds a short-lived EdDSA JWT (via
 *    `buildAuthJwt`) and injects it as `Authorization: Bearer <jwt>`.
 *    When the wallet is locked (`getAuthKeypair()` → null) the config is
 *    returned unmodified and the backend permissively allows the request.
 *
 * 2. **Response interceptor**: on a 401, rebuilds the JWT once and re-issues
 *    the request via `instance.request(config)`, returning that response
 *    (success or the second 401). A `__isAuthRetry` flag prevents infinite
 *    loops. Mirrors the extension's `authedFetch` (retry-once-then-return).
 *
 * Path derivation
 * ---------------
 * The JWT `methodAndPath` must match the server's `r.URL.RequestURI()` (full
 * path + query). We derive it from `instance.getUri(config)` — axios's own
 * baseURL-join + param serializer, i.e. exactly what it will put on the wire —
 * and strip the origin to `pathname + search`. Delegating means the signed path
 * cannot drift from the wire path (both route through the same builder), and we
 * leave `config.params` untouched; axios serializes them identically.
 *
 * Example:
 *   baseURL = "https://api.example.com/api/v1"
 *   url     = "/protocols", params = { network: "PUBLIC" }
 *   signed  = "/api/v1/protocols?network=PUBLIC"          ✓
 *
 * Body hashing
 * ------------
 * Object bodies are serialized here — in the request interceptor, before
 * axios's own `transformRequest` — so the bytes hashed into `bodyHash` are
 * exactly the bytes that go on the wire.  Call sites pass plain objects; an
 * already-serialized string is left untouched; GET/no-body yields an empty
 * bodyHash.  (The anonymous/locked path lets axios serialize the object
 * normally, producing the identical JSON bytes, so the two paths agree.)
 *
 * Import strategy
 * ---------------
 * `getAuthKeypair` and `buildAuthJwt` are imported lazily inside the
 * interceptor callbacks (via `require()`). This keeps the module load of
 * `attachAuth.ts` itself side-effect-free so that tests which import
 * `backend.ts` indirectly (e.g. via a duck) do not inadvertently pull in
 * `ducks/auth` → `react-native-config` at import time. Interceptor
 * callbacks only fire when an actual request is made, so the lazy require
 * never runs in tests that mock the store/duck and never exercise the
 * backend HTTP layer.
 */
import { AxiosInstance, InternalAxiosRequestConfig } from "axios";

/**
 * Internal marker added to config when we have already attempted one
 * JWT refresh-and-retry cycle for a given request.  Prevents infinite
 * retry loops on persistent 401s.
 */
interface AuthRetryConfig extends InternalAxiosRequestConfig {
  __isAuthRetry?: boolean;
}

/** Strips any Authorization header so a request goes out anonymously. */
function stripAuthHeaders(config: InternalAxiosRequestConfig): void {
  if (!config.headers) return;
  /* eslint-disable no-param-reassign */
  delete (config.headers as Record<string, unknown>).Authorization;
  delete (config.headers as Record<string, unknown>).authorization;
  /* eslint-enable no-param-reassign */
}

/**
 * Derives the server request-target (pathname + search) that axios will put on
 * the wire, so the signed JWT `methodAndPath` equals the server's
 * `r.URL.RequestURI()` by construction.
 *
 * We delegate to `instance.getUri(config)` — the same `baseURL` join + param
 * serializer axios uses to build the actual request URL — rather than
 * hand-rolling the merge. That guarantees signed path == wire path (and stays
 * true across axios upgrades, since both route through the same builder). We
 * only strip the origin down to `pathname + search`; axios owns the rest.
 */
function deriveServerPath(
  instance: AxiosInstance,
  config: InternalAxiosRequestConfig,
): string {
  // Strip the scheme://host[:port] origin from what axios will send, leaving
  // exactly the pathname+query it puts on the wire.
  //
  // Do NOT use `new URL(...).pathname`: React Native's built-in URL is NOT
  // WHATWG-compliant — its constructor appends a trailing "/" to any URL with
  // no "?"/"#" (RN 0.81 Libraries/Blob/URL.js), so a query-less request would
  // sign "/api/v1/x/" while the wire target is "/api/v1/x" → guaranteed 401.
  // Jest uses Node's compliant URL, so that divergence is invisible in tests.
  // A plain origin-strip is environment-independent and preserves getUri's
  // output verbatim (== the wire request-target).
  const uri = instance.getUri(config);
  return uri.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "") || "/";
}

/**
 * Attaches per-request JWT authentication interceptors to `instance`.
 *
 * ORDERING REQUIREMENT: This function MUST be wired via the `configureInstance`
 * hook of `createApiService` (not called after `createApiService` returns).
 * Axios runs response interceptors in registration order.  The 401-retry
 * handler below inspects `error.response?.status` and `error.config` — fields
 * that are present on a raw AxiosError but are stripped by apiFactory's
 * error-normalizing response interceptor (which converts the error into a plain
 * `ApiError`).  If this function were called after `createApiService`, the
 * retry handler would be registered *after* the normalizer and would never fire
 * on a real 401: by the time it runs, the error is already an `ApiError` with
 * no `.response` property.
 *
 * Using `configureInstance` guarantees these interceptors are registered BEFORE
 * the normalizer, so the 401-retry path works correctly in production.
 */
export function attachAuthInterceptors(instance: AxiosInstance): void {
  // ------------------------------------------------------------------
  // 1. Request interceptor — inject JWT when unlocked
  //
  // `getAuthKeypair` and `buildAuthJwt` are required lazily here so that
  // importing `attachAuth` (and transitively `backend.ts`) does not pull
  // `ducks/auth` into the module graph at import time. Tests that load
  // `backend.ts` indirectly (e.g. via a duck) but never make HTTP
  // requests will never trigger these requires.
  // ------------------------------------------------------------------
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
      const { getAuthKeypair } =
        require("services/auth/getAuthKeypair") as typeof import("services/auth/getAuthKeypair");
      /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
      const keypair = await getAuthKeypair();
      if (!keypair) {
        // Wallet is locked — pass through anonymously. Strip any stale
        // Authorization header first: a 401-retry copies the failed request's
        // config (which carried a Bearer token), so if the wallet locked
        // between the original request and the retry, returning config as-is
        // would re-send the now-stale token. Locked requests must be anonymous.
        stripAuthHeaders(config);
        return config;
      }

      /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
      const { buildAuthJwt } =
        require("services/auth/buildAuthJwt") as typeof import("services/auth/buildAuthJwt");
      /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */

      // Sign the exact request-target axios will send (baseURL + url + params),
      // leaving config.params in place — axios serializes them identically on
      // the wire, so signed path == wire path with no manual folding.
      const serverPath = deriveServerPath(instance, config);
      const method = config.method ?? "get";

      // Serialize plain JSON bodies here — before axios's transformRequest — so
      // the bytes we hash are exactly the bytes that go on the wire. A string
      // body passes through untouched (no double-encode); GET/no-body stays
      // undefined. Only plain objects / arrays are serialized: FormData / Blob /
      // URLSearchParams etc. are left alone (JSON.stringify would corrupt them to
      // "{}" on the wire). No such body exists on a v2 call site today; a future
      // non-JSON authenticated body would need explicit bodyHash handling.
      const isPlainJsonBody =
        typeof config.data === "object" &&
        config.data !== null &&
        ((config.data as object).constructor === Object ||
          Array.isArray(config.data));
      if (isPlainJsonBody) {
        // eslint-disable-next-line no-param-reassign
        config.data = JSON.stringify(config.data);
      }
      const body = typeof config.data === "string" ? config.data : undefined;

      const jwt = buildAuthJwt({
        keypair,
        method,
        path: serverPath,
        body,
      });

      // `config.headers` is always present on InternalAxiosRequestConfig.
      // Cast to avoid index-signature complaints from strict typing.
      // Mutating config.headers is idiomatic axios interceptor usage.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
      (config.headers as Record<string, any>).Authorization = `Bearer ${jwt}`;

      return config;
    },
  );

  // ------------------------------------------------------------------
  // 2. Response interceptor — retry once on 401
  // ------------------------------------------------------------------
  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as { response?: { status?: number }; config?: any };
      const config = err.config as AuthRetryConfig | undefined;

      // Only retry if the original request actually carried a JWT.
      // Retrying an anonymous request is pointless — nothing would change on
      // the second attempt (the wallet is locked, so no Authorization header
      // would be attached) and it would double locked-wallet traffic.
      const hadAuth = Boolean(
        (config?.headers as Record<string, unknown> | undefined)?.Authorization,
      );

      if (
        err.response?.status === 401 &&
        config !== undefined &&
        !config.__isAuthRetry &&
        hadAuth
      ) {
        // Spread into a new config object to avoid mutating the original
        // (satisfies no-param-reassign) while marking the retry flag.
        const retryConfig: AuthRetryConfig = {
          ...config,
          __isAuthRetry: true,
        };
        // The request interceptor above will rebuild a fresh JWT when
        // instance.request() runs again.
        return instance.request(retryConfig);
      }

      // Not a retryable 401 (already retried, non-401, or anonymous): reject.
      // A persistent 401 surfaces to the caller — we do NOT fall back to an
      // anonymous request (matches the extension's authedFetch; clock-skew
      // handling is deferred to the backend leeway, see #930).
      return Promise.reject(error);
    },
  );
}
