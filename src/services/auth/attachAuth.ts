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
 * 2. **Response interceptor**: on a 401, rebuilds the JWT once and
 *    re-issues the request via `instance.request(config)`.  A
 *    `__isAuthRetry` flag on the config prevents infinite loops.
 *
 * Path derivation
 * ---------------
 * The JWT `methodAndPath` field must match the server's
 * `r.URL.RequestURI()` value, which includes the full path + query.
 * Because the axios `baseURL` already ends with `/api/v1` and per-call
 * `url` values look like `/protocols?network=PUBLIC`, we cannot use
 * `new URL(url, baseURL)` — that resolves relative to the *origin* and
 * silently drops the `/api/v1` prefix.  Instead we concatenate:
 *
 *   `<baseURL (trailing slash stripped)> + <url>`
 *
 * then parse with `new URL()` to extract `pathname + search`.
 *
 * Example:
 *   baseURL = "https://api.example.com/api/v1"
 *   url     = "/protocols?network=PUBLIC"
 *   path    = "/api/v1/protocols?network=PUBLIC"          ✓
 *
 * Body hashing
 * ------------
 * Only a pre-serialized string `config.data` is hashed.  If `config.data`
 * is an object (i.e. the caller forgot to JSON.stringify before passing
 * it), we pass `body: undefined` (empty bodyHash) and emit a dev-mode
 * warning.  Call sites should be migrated to pre-serialize, but that is
 * outside the scope of this task.
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
import { logger } from "config/logger";

/**
 * Internal marker added to config when we have already attempted one
 * JWT refresh-and-retry cycle for a given request.  Prevents infinite
 * retry loops on persistent 401s.
 */
interface AuthRetryConfig extends InternalAxiosRequestConfig {
  __isAuthRetry?: boolean;
}

/**
 * Derives the full server request-target (pathname + search) from the
 * axios request config so it matches `r.URL.RequestURI()` on the server.
 *
 * NOTE: We concatenate rather than using `new URL(url, baseURL)` because
 * axios baseURLs end with a path segment (`/api/v1`) and a url that starts
 * with `/` would be treated as an absolute path relative to the origin,
 * silently dropping the prefix.
 */
function deriveServerPath(
  baseURL: string | undefined,
  url: string | undefined,
): string {
  const base = (baseURL ?? "").replace(/\/+$/, "");
  const urlPath = url ?? "/";
  // url should always start with "/" when coming from axios; normalise just in case.
  const normalizedPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  try {
    const parsed = new URL(`${base}${normalizedPath}`);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    // Fallback: return the raw path component stripped of origin.
    return normalizedPath;
  }
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
        // Wallet is locked — pass through without auth.
        return config;
      }

      /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */
      const { buildAuthJwt } =
        require("services/auth/buildAuthJwt") as typeof import("services/auth/buildAuthJwt");
      /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require */

      const serverPath = deriveServerPath(config.baseURL, config.url);
      const method = config.method ?? "get";

      // Only hash string bodies.  If the body is an object the caller has
      // not pre-serialized it; warn in dev and skip body hashing.
      let body: string | undefined;
      if (typeof config.data === "string") {
        body = config.data;
      } else if (config.data !== undefined && config.data !== null) {
        if (__DEV__) {
          logger.warn(
            "attachAuth",
            "config.data is not a string — body will not be hashed. " +
              "Pre-serialize the request body before passing it to axios.",
            { method, path: serverPath, dataType: typeof config.data },
          );
        }
        body = undefined;
      }

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

      return Promise.reject(error);
    },
  );
}
