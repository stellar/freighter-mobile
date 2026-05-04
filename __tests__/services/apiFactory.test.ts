/* eslint-disable @fnando/consistent-import/consistent-import */
import { ApiError, isApiNetworkError } from "services/apiFactory";

describe("apiFactory", () => {
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
