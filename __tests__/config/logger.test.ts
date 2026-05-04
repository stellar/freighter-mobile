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

    it("attaches variadic args as breadcrumb data preserving array shape", () => {
      logger.warn("ContextA", "something happened", { foo: "bar" }, 42);

      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "ContextA",
          message: "something happened",
          level: "warning",
          data: { args: [{ foo: "bar" }, 42] },
        }),
      );
    });

    it("redacts PII keys nested inside variadic arg objects", () => {
      logger.warn("ContextA", "something happened", {
        password: "secret",
        publicKey: "GA...",
        normalField: "ok",
      });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          {
            password: "[REDACTED]",
            publicKey: "GA...",
            normalField: "ok",
          },
        ],
      });
    });

    it("recurses into deeply nested objects to redact PII", () => {
      logger.warn("ContextA", "something happened", {
        outer: {
          inner: {
            mnemonic: "word word word",
            other: "ok",
          },
        },
      });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          {
            outer: {
              inner: {
                mnemonic: "[REDACTED]",
                other: "ok",
              },
            },
          },
        ],
      });
    });

    it("redacts PII inside arrays of objects (e.g. account list)", () => {
      logger.warn("ContextA", "something happened", [
        { id: "a", privateKey: "S1" },
        { id: "b", privateKey: "S2" },
      ]);

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          [
            { id: "a", privateKey: "[REDACTED]" },
            { id: "b", privateKey: "[REDACTED]" },
          ],
        ],
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

    it("forwards the caller's `message` arg into Sentry extras (not just console)", () => {
      // The Sentry title comes from the Error.message (preserves
      // grouping), but the caller's intent string ("operation failed")
      // would otherwise be lost on the Sentry path. It's inspectable
      // in the event extras now.
      const err = new Error("boom");

      logger.error("ContextA", "Failed at step 2 (token refresh)", err);

      expect(mockedSentry.captureException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({
          tags: { context: "ContextA" },
          extra: expect.objectContaining({
            message: "Failed at step 2 (token refresh)",
          }),
        }),
      );
    });

    it("merges `message` and `args` into a single extras object", () => {
      const err = new Error("boom");

      logger.error("ContextA", "User-friendly description", err, {
        userId: "x",
      });

      expect(mockedSentry.captureException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({
          extra: {
            message: "User-friendly description",
            args: [{ userId: "[REDACTED]" }],
          },
        }),
      );
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
