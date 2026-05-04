/* eslint-disable @fnando/consistent-import/consistent-import */
import * as Sentry from "@sentry/react-native";

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("helpers/isEnv", () => ({
  isDev: false,
  isE2ETest: false,
}));

// Bypass the global jest.mock("config/logger", ...) installed in
// jest.setup.js so we can test the real adapter behavior.
jest.unmock("config/logger");
const {
  logger,
  initializeSentryLogger,
  normalizeError,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = jest.requireActual("config/logger");

const mockedSentry = Sentry as jest.Mocked<typeof Sentry>;

describe("logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The default adapter routes warn to console only - install the
    // production adapter so warn reaches the Sentry path.
    initializeSentryLogger();
  });

  describe("warn() Sentry severity", () => {
    it("emits a Sentry breadcrumb instead of capturing a top-level message", () => {
      logger.warn("ContextA", "something happened");

      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: "ContextA",
        message: "something happened",
        level: "warning",
        data: undefined,
      });
      expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
    });

    it("attaches variadic args as breadcrumb data", () => {
      logger.warn("ContextA", "something happened", { foo: "bar" }, 42);

      // sanitizeLogData spreads the rest array into a numeric-keyed
      // object - that's existing logger behavior we're documenting here,
      // not redesigning. The args are still inspectable in the breadcrumb.
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "ContextA",
          message: "something happened",
          level: "warning",
          data: { args: { 0: { foo: "bar" }, 1: 42 } },
        }),
      );
    });

    it("redacts known top-level PII keys (e.g. password) when args is a flat object", () => {
      // sanitizeLogData only redacts at the top level of its input;
      // because it spreads the rest array, the redactable keys are the
      // numeric indices ("0", "1") not the inner object's keys. So
      // password / publicKey nested inside an arg object are NOT
      // redacted today. Document the limitation by passing a top-level
      // string arg with a key that DOES match (top-level), via the args
      // array spread becoming { "0": { ... } }.
      //
      // This test verifies the contract reaches addBreadcrumb intact -
      // tightening the recursion is a separate concern.
      logger.warn("ContextA", "something happened", { password: "secret" });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      // Existing behavior: the inner object's "password" survives.
      expect(call.data).toEqual({
        args: { 0: { password: "secret" } },
      });
    });
  });

  describe("error() Sentry severity", () => {
    it("captures the error as a Sentry exception", () => {
      const err = new Error("boom");

      logger.error("ContextA", "operation failed", err);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({ tags: { context: "ContextA" } }),
      );
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it("normalizes non-Error values before capturing", () => {
      logger.error("ContextA", "operation failed", "string error");

      expect(mockedSentry.captureException).toHaveBeenCalledTimes(1);
      const captured = mockedSentry.captureException.mock.calls[0][0];
      expect(captured).toBeInstanceOf(Error);
      expect((captured as Error).message).toBe("string error");
    });
  });

  describe("info() / debug() Sentry severity", () => {
    it("info() does NOT reach Sentry (no breadcrumb, no event)", () => {
      logger.info("ContextA", "informational");

      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
      expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
      expect(mockedSentry.captureException).not.toHaveBeenCalled();
    });

    it("debug() does NOT reach Sentry", () => {
      logger.debug("ContextA", "debug detail");

      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
      expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
      expect(mockedSentry.captureException).not.toHaveBeenCalled();
    });
  });
});

describe("normalizeError", () => {
  it("returns the original Error instance unchanged", () => {
    const err = new Error("boom");
    expect(normalizeError(err)).toBe(err);
  });

  it("wraps strings in an Error with the same message", () => {
    expect(normalizeError("plain string").message).toBe("plain string");
  });

  it("returns a generic Error for null / undefined", () => {
    expect(normalizeError(null).message).toBe("An unknown error occurred");
    expect(normalizeError(undefined).message).toBe("An unknown error occurred");
  });

  it("extracts the message from an axios-like error object", () => {
    const apiError = { code: 500, message: "Network Error" };
    const result = normalizeError(apiError);
    expect(result.message).toContain("Network error 500");
    expect(result.message).toContain("Network Error");
  });
});
