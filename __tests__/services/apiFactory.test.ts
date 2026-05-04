/* eslint-disable @fnando/consistent-import/consistent-import */
import { AxiosAdapter } from "axios";
import {
  ApiError,
  createApiService,
  isApiNetworkError,
} from "services/apiFactory";

describe("apiFactory", () => {
  describe("response interceptor: error transformation contract", () => {
    // Drives a real axios instance through the response interceptor with a
    // custom adapter so we can assert the thrown ApiError shape that every
    // caller in the codebase relies on (status, isNetworkError, data).
    const driveAdapter = (adapter: AxiosAdapter) => {
      const api = createApiService({ baseURL: "https://example.test" });
      return api.get<unknown>("/path", { adapter });
    };

    it("no-response failures throw an ApiError with status: 0 and isNetworkError: true", async () => {
      // Simulates offline / DNS / TLS / captive-portal: axios resolves
      // with no `response` field on the error.
      const noResponseAdapter: AxiosAdapter = () =>
        Promise.reject(
          Object.assign(new Error("Network Error"), { response: undefined }),
        );

      try {
        await driveAdapter(noResponseAdapter);
        fail("expected interceptor to throw");
      } catch (caught) {
        const apiError = caught as ApiError;
        expect(apiError.status).toBe(0);
        expect(apiError.isNetworkError).toBe(true);
        expect(apiError.message).toBe("Network Error");
        expect(isApiNetworkError(apiError)).toBe(true);
      }
    });

    it("axios timeouts (no response) are treated as network errors (status: 0)", async () => {
      // axios surfaces timeouts as `Error: timeout of Xms exceeded` with
      // no `response` field - same shape as offline. Pin this so callers
      // branching on isApiNetworkError pick up timeouts too.
      const timeoutAdapter: AxiosAdapter = () =>
        Promise.reject(
          Object.assign(new Error("timeout of 15000ms exceeded"), {
            code: "ECONNABORTED",
            response: undefined,
          }),
        );

      try {
        await driveAdapter(timeoutAdapter);
        fail("expected interceptor to throw");
      } catch (caught) {
        const apiError = caught as ApiError;
        expect(apiError.status).toBe(0);
        expect(apiError.isNetworkError).toBe(true);
        expect(isApiNetworkError(apiError)).toBe(true);
      }
    });

    it("backend response errors throw an ApiError preserving status + data, with isNetworkError: false", async () => {
      // Real HTTP error responses (4xx/5xx) still need to surface as
      // ApiError with the actual status + body so callers can branch.
      const responseAdapter: AxiosAdapter = () =>
        Promise.reject(
          Object.assign(new Error("Request failed with status code 500"), {
            response: {
              status: 500,
              data: { error: "boom" },
            },
          }),
        );

      try {
        await driveAdapter(responseAdapter);
        fail("expected interceptor to throw");
      } catch (caught) {
        const apiError = caught as ApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.isNetworkError).toBe(false);
        expect(apiError.data).toEqual({ error: "boom" });
        expect(isApiNetworkError(apiError)).toBe(false);
      }
    });
  });

  describe("isApiNetworkError", () => {
    it("matches an ApiError-shaped object with isNetworkError: true", () => {
      const networkErr: ApiError = {
        message: "Network Error",
        status: 0,
        isNetworkError: true,
      };
      expect(isApiNetworkError(networkErr)).toBe(true);
    });

    it("does NOT match an ApiError with isNetworkError: false (real backend response)", () => {
      const realApiErr: ApiError = {
        message: "Bad request",
        status: 400,
        isNetworkError: false,
      };
      expect(isApiNetworkError(realApiErr)).toBe(false);
    });

    it("does NOT match a regular Error instance", () => {
      expect(isApiNetworkError(new Error("oops"))).toBe(false);
    });

    it("does NOT match a plain object missing isNetworkError", () => {
      expect(isApiNetworkError({ message: "oops", status: 500 })).toBe(false);
    });

    it("does NOT match null / undefined / primitives", () => {
      expect(isApiNetworkError(null)).toBe(false);
      expect(isApiNetworkError(undefined)).toBe(false);
      expect(isApiNetworkError("string")).toBe(false);
      expect(isApiNetworkError(42)).toBe(false);
    });

    it("does NOT match objects with isNetworkError: false-y but not strictly true", () => {
      // Guard against truthy but non-boolean values from third-party
      // error shapes that happen to have an isNetworkError key.
      expect(isApiNetworkError({ isNetworkError: 1 })).toBe(false);
      expect(isApiNetworkError({ isNetworkError: "true" })).toBe(false);
      expect(isApiNetworkError({ isNetworkError: undefined })).toBe(false);
    });
  });
});
