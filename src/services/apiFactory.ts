import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "config/logger";
import { debug } from "helpers/debug";

/**
 * API factory module for creating API service instances with consistent behavior.
 * Provides a clean interface for making HTTP requests with features like:
 * - Consistent error handling
 * - Automatic retry with exponential backoff
 * - Authorization token management
 *
 * @example
 * // Create an API service
 * const userApi = createApiService({
 *   baseURL: 'https://api.example.com/users'
 * });
 *
 * // Make requests
 * const getUser = async (userId) => {
 *   try {
 *     const { data } = await userApi.get(`/${userId}`);
 *     return data;
 *   } catch (error) {
 *     console.error('Failed to fetch user:', error.message);
 *     return null;
 *   }
 * };
 */

/**
 * Response wrapper for all API requests
 * @template T The expected data type returned by the API
 */
export interface ApiResponse<T> {
  /** The response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
}

/**
 * Standardized error object thrown by API requests
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** HTTP status code (or 0 if no response) */
  status: number;
  /** Optional response data from the server */
  data?: unknown;
  /** Whether this was a network error rather than a response error */
  isNetworkError: boolean;
}

/**
 * Configuration for request retry behavior
 */
export interface RetryConfig {
  /** Number of retry attempts (excluding the initial request) */
  retries: number;
  /** Initial delay in ms before the first retry (will increase exponentially) */
  initialDelay?: number;
}

/**
 * Extended request configuration that includes retry options
 */
export interface RequestConfig extends Omit<AxiosRequestConfig, "baseURL"> {
  /**
   * Retry configuration for this specific request
   * @example
   * // Retry up to 3 times with exponential backoff starting at 1s
   * api.get('/endpoint', {
   *   retry: { retries: 3, initialDelay: 1000 }
   * });
   */
  retry?: RetryConfig;
  signal?: AbortSignal;
}

/**
 * Options for creating an API service instance
 */
export interface ApiServiceOptions {
  /** Base URL for all requests made by this service */
  baseURL: string;
  /** Default timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Default headers to include with every request */
  headers?: Record<string, string>;
  /** Whether to log requests and responses */
  logRequests?: boolean;
  /**
   * Optional hook invoked on the raw AxiosInstance BEFORE the error-normalizing
   * response interceptor is registered.  Use this to attach interceptors that
   * must run BEFORE the normalizer on the error path (e.g. a 401-retry handler
   * that needs access to `error.response` and `error.config` — both of which
   * the normalizer strips when it converts the AxiosError into a plain ApiError).
   *
   * Axios runs response interceptors in registration order, so any response
   * interceptor added here is guaranteed to see the raw AxiosError.
   *
   * @example
   * createApiService({ baseURL, configureInstance: attachAuthInterceptors })
   */
  configureInstance?: (instance: AxiosInstance) => void;
}

/**
 * Type guard that returns true for any value that has already been normalized
 * into an ApiError by the apiFactory response interceptor.  Used by the
 * normalizer itself to make error normalization idempotent: when a nested
 * instance.request() (e.g. the JWT 401-retry in attachAuth) surfaces an
 * ApiError up through the outer interceptor chain, the normalizer must not
 * re-process it — doing so would clobber the real status (e.g. 401 → 0)
 * because ApiError carries no .response field.
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    !axios.isAxiosError(error) &&
    "status" in error &&
    typeof (error as ApiError).status === "number" &&
    "isNetworkError" in error &&
    typeof (error as ApiError).isNetworkError === "boolean" &&
    "message" in error &&
    typeof (error as ApiError).message === "string"
  );
}

/**
 * Creates an API service instance with consistent behavior and error handling
 *
 * @param options Configuration options for the API service
 * @returns An object with methods for making API requests
 *
 * @example
 * // Basic usage
 * const api = createApiService({ baseURL: 'https://api.example.com/v1' });
 * const { data } = await api.get('/users');
 *
 * @example
 * // With retry
 * const api = createApiService({ baseURL: 'https://api.example.com/v1' });
 * const { data } = await api.get('/users', {
 *   retry: { retries: 3, initialDelay: 1000 }
 * });
 *
 * @example
 * // Error handling
 * try {
 *   const { data } = await api.post('/users', { name: 'John' });
 *   console.log('User created:', data);
 * } catch (error) {
 *   if (error.status === 401) {
 *     // Handle unauthorized
 *   } else if (error.isNetworkError) {
 *     // Handle network issues
 *   } else {
 *     // Handle other errors
 *   }
 * }
 */
export function createApiService(options: ApiServiceOptions) {
  const {
    baseURL,
    timeout = 15000,
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    logRequests = false,
    configureInstance,
  } = options;

  // Create axios instance
  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout,
    headers,
  });

  if (logRequests) {
    instance.interceptors.request.use((request) => {
      debug("Starting Request", JSON.stringify(request, null, 2));
      return request;
    });

    instance.interceptors.response.use((response) => {
      debug("Response:", JSON.stringify(response, null, 2));
      return response;
    });
  }

  // Allow the caller to register interceptors on the raw instance BEFORE the
  // error-normalizing response interceptor below.  Axios runs response
  // interceptors in registration order, so any response interceptor added by
  // this hook sees the original AxiosError (with .response / .config intact)
  // before the normalizer converts it to a plain ApiError and drops those
  // fields.  This is the correct insertion point for a 401-retry handler.
  configureInstance?.(instance);

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    (error) => {
      // If the error is already a normalized ApiError (e.g. surfaced from a
      // nested instance.request() inside another interceptor, like the JWT
      // 401-retry), don't re-normalize — a second pass would clobber the
      // real status (e.g. 401) to 0 because ApiError has no .response field.
      if (isApiError(error)) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw error;
      }

      // When the server didn't respond at all (offline, DNS, TLS failure,
      // captive portal, request aborted before headers), use 0 as the
      // status to match the ApiError contract ("HTTP status code (or 0
      // if no response)"). Avoid defaulting to a real HTTP code like
      // 500: that would make connectivity failures indistinguishable
      // from genuine backend errors in error reporting.
      //
      // `isNetworkError` is reserved for genuine connectivity failures
      // (offline, DNS, TLS, captive portal). Axios timeouts also have
      // `error.response === undefined` but represent backend latency,
      // not connectivity - they are deliberately excluded so consumers
      // branching on `isApiNetworkError` route them to `logger.error`
      // and preserve Sentry visibility for latency regressions.
      const apiError: ApiError = {
        message: error.message || "An error occurred",
        status: error.response?.status ?? 0,
        data: error.response?.data,
        // ECONNABORTED is the axios code for "request aborted by the
        // client" - which in practice almost always means the
        // configured `timeout` elapsed before the server responded.
        // Excluding it from `isNetworkError` keeps timeouts on the
        // logger.error path (real backend latency) rather than the
        // logger.warn / connectivity path.
        isNetworkError:
          axios.isAxiosError(error) &&
          !error.response &&
          error.code !== "ECONNABORTED",
      };
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */

      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw apiError;
    },
  );

  /**
   * Executes a request function with retry capability using exponential backoff
   *
   * @param requestFn Function that performs the actual request
   * @param retryOptions Configuration for retry behavior
   * @returns Promise resolving to the request result
   */
  const executeWithRetry = async <T>(
    requestFn: () => Promise<T>,
    retryOptions?: RetryConfig,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (signal?.aborted) throw new axios.CanceledError("canceled");

    if (!retryOptions || retryOptions.retries <= 0) {
      return requestFn();
    }

    let lastError;
    let attempts = 0;
    const maxAttempts = retryOptions.retries + 1; // +1 for initial attempt
    const initialDelay = retryOptions.initialDelay || 1000;

    /* eslint-disable no-await-in-loop */
    while (attempts < maxAttempts) {
      try {
        return await requestFn();
      } catch (error) {
        if (signal?.aborted) throw new axios.CanceledError("canceled");
        attempts++;
        lastError = error;

        // If this was the last attempt, throw the error
        if (attempts >= maxAttempts) {
          throw error;
        }

        // Calculate exponential delay: initialDelay * 2^(attemptNumber-1)
        const exponentialDelay = initialDelay * 2 ** (attempts - 1);

        // Wait before retrying
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, exponentialDelay));
      }
    }
    /* eslint-enable no-await-in-loop */

    throw lastError;
  };

  // Return API methods
  return {
    /**
     * Makes a GET request
     *
     * @param url The URL to request (will be appended to baseURL)
     * @param config Additional request configuration
     * @returns Promise with the API response
     *
     * @example
     * // Simple GET request
     * const { data } = await api.get('/users');
     *
     * @example
     * // GET with URL parameters
     * const { data } = await api.get('/users', {
     *   params: { role: 'admin', active: true }
     * });
     *
     * @example
     * // GET with retry
     * const { data } = await api.get('/users', {
     *   retry: { retries: 3, initialDelay: 1000 }
     * });
     */
    async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      const { retry, ...axiosConfig } = config || {};

      return executeWithRetry(async () => {
        const response = await instance.get<T>(url, axiosConfig);
        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
        };
      }, retry);
    },

    /**
     * Makes a POST request
     *
     * @param url The URL to request (will be appended to baseURL)
     * @param data The data to send in the request body
     * @param config Additional request configuration
     * @returns Promise with the API response
     *
     * @example
     * // Basic POST request
     * const { data } = await api.post('/users', { name: 'John', email: 'john@example.com' });
     *
     * @example
     * // POST with custom headers
     * const { data } = await api.post(
     *   '/users',
     *   { name: 'John' },
     *   { headers: { 'X-Custom-Header': 'value' } }
     * );
     */
    async post<T>(
      url: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      const { retry, ...axiosConfig } = config || {};

      return executeWithRetry(async () => {
        const response = await instance.post<T>(url, data, axiosConfig);
        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
        };
      }, retry);
    },

    /**
     * Makes a PUT request
     *
     * @param url The URL to request (will be appended to baseURL)
     * @param data The data to send in the request body
     * @param config Additional request configuration
     * @returns Promise with the API response
     *
     * @example
     * // Basic PUT request
     * const { data } = await api.put('/users/123', { name: 'Updated Name' });
     */
    async put<T>(
      url: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      const { retry, ...axiosConfig } = config || {};

      return executeWithRetry(async () => {
        const response = await instance.put<T>(url, data, axiosConfig);
        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
        };
      }, retry);
    },

    /**
     * Makes a DELETE request
     *
     * @param url The URL to request (will be appended to baseURL)
     * @param config Additional request configuration
     * @returns Promise with the API response
     *
     * @example
     * // Basic DELETE request
     * const { status } = await api.delete('/users/123');
     * if (status === 204) {
     *   console.log('User deleted successfully');
     * }
     */
    async delete<T>(
      url: string,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      const { retry, ...axiosConfig } = config || {};

      return executeWithRetry(async () => {
        const response = await instance.delete<T>(url, axiosConfig);
        return {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
        };
      }, retry);
    },

    /**
     * Sets the Authorization header for all subsequent requests
     *
     * @param token The authentication token (will be prefixed with 'Bearer ')
     *
     * @example
     * // Set auth token
     * api.setAuthToken('my-jwt-token');
     *
     * // Make authenticated request
     * const { data } = await api.get('/protected-resource');
     */
    setAuthToken(token: string): void {
      instance.defaults.headers.common.Authorization = `Bearer ${token}`;
    },

    /**
     * Returns the underlying axios instance for advanced usage
     *
     * @returns The axios instance
     *
     * @example
     * // Access the underlying axios instance for advanced configuration
     * const axiosInstance = api.getInstance();
     * axiosInstance.interceptors.request.use(config => {
     *   config.headers['X-Timestamp'] = Date.now().toString();
     *   return config;
     * });
     */
    getInstance(): AxiosInstance {
      return instance;
    },
  };
}

export function isRequestCanceled(error: unknown): boolean {
  // Axios <1 cancels.
  if (axios.isCancel(error)) return true;

  // Axios >=1 + AbortController surfaces a cancel as a plain object
  // with `message: "canceled"`.
  if (typeof error !== "object" || error === null) return false;
  return (
    "message" in error && (error as { message?: string }).message === "canceled"
  );
}

/**
 * Type guard for ApiError values produced by the apiFactory response
 * interceptor when the server didn't respond at all (offline, DNS, TLS,
 * captive portal, etc.). Use this to branch error handling so connectivity
 * failures don't get logged with the same severity as real backend bugs.
 */
export function isApiNetworkError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "isNetworkError" in error &&
    (error as ApiError).isNetworkError === true
  );
}

/**
 * Routes an API error to `logger.warn` (connectivity failures) or
 * `logger.error` (real backend bugs / timeouts) based on
 * `isApiNetworkError`.
 *
 * @param context     Logger context (typically the module/function name)
 * @param warnMessage Message used when the failure is a connectivity issue
 * @param errorMessage Message used when the failure is a real backend bug
 * @param error       The thrown value from the API call
 * @param args        Optional structured args forwarded to the logger
 */
export const logApiError = (
  context: string,
  warnMessage: string,
  errorMessage: string,
  error: unknown,
  ...args: unknown[]
): void => {
  if (isApiNetworkError(error)) {
    logger.warn(context, warnMessage, error, ...args);
  } else {
    logger.error(context, errorMessage, error, ...args);
  }
};
