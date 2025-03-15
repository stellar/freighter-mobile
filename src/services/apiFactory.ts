import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

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
  } = options;

  // Create axios instance
  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout,
    headers,
  });

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    (error) => {
      const apiError: ApiError = {
        message: error.message || "An error occurred",
        status: error.response?.status || 500,
        data: error.response?.data,
        isNetworkError: !error.response,
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
  ): Promise<T> => {
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
    async post<T, D = unknown>(
      url: string,
      data?: D,
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
    async put<T, D = unknown>(
      url: string,
      data?: D,
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
