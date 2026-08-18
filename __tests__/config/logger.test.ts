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
  sanitizeLogData,
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

    it("preserves Error message and stack when an Error is passed as a variadic arg", () => {
      // Regression: callers like `logger.warn(ctx, "Failed", err)` rely
      // on the breadcrumb carrying err.message / err.stack. Without
      // the Error special case in sanitizeLogData, the breadcrumb
      // would ship `{ args: [{}] }` because Error fields are
      // non-enumerable, silently dropping the diagnostic.
      const err = new Error("token refresh failed");
      logger.warn("AuthFlow", "step 2 failed", err);

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      const { args } = call.data as {
        args: Array<{ message?: string; stack?: string }>;
      };
      expect(args[0].message).toBe("token refresh failed");
      expect(typeof args[0].stack).toBe("string");
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
        normalField: "ok",
      });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          {
            password: "[REDACTED]",
            normalField: "ok",
          },
        ],
      });
    });

    it("redacts publicKey (camelCase) and public_key (snake_case)", () => {
      // publicKey isn't strictly secret, but the codebase gates it on
      // the analytics opt-in (see buildSentryContext). Redact in logger
      // payloads to extend that opt-out promise to breadcrumbs / extras.
      // Backend payloads arrive snake_case, so both forms must redact.
      logger.warn("ContextA", "something happened", {
        publicKey: "GA_CAMEL",
        public_key: "GA_SNAKE",
        normalField: "ok",
      });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          {
            publicKey: "[REDACTED]",
            public_key: "[REDACTED]",
            normalField: "ok",
          },
        ],
      });
    });

    it("redacts other snake_case PII variants (account_id, private_key, etc.)", () => {
      logger.warn("ContextA", "something happened", {
        account_id: "GA...",
        private_key: "S...",
        secret_key: "S...",
        api_key: "ak_...",
        ip_address: "1.2.3.4",
        normalField: "ok",
      });

      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({
        args: [
          {
            account_id: "[REDACTED]",
            private_key: "[REDACTED]",
            secret_key: "[REDACTED]",
            api_key: "[REDACTED]",
            ip_address: "[REDACTED]",
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

describe("sanitizeLogData Error preservation", () => {
  it("preserves message and stack from a bare Error (non-enumerable per spec)", () => {
    const err = new Error("boom");

    const sanitized = sanitizeLogData(err) as {
      name: string;
      message: string;
      stack: string;
    };

    expect(sanitized.name).toBe("Error");
    expect(sanitized.message).toBe("boom");
    expect(typeof sanitized.stack).toBe("string");
    expect(sanitized.stack).toContain("boom");
  });

  it("preserves Error fields when nested inside the variadic args array", () => {
    // The actual logger.warn / logger.error path: callers pass an Error
    // as a variadic arg, sanitizeLogData walks the args ARRAY, then
    // reaches each Error. Must produce a useful object, not `{}`.
    const err = new Error("nested boom");

    const sanitized = sanitizeLogData([err, { ok: true }]) as Array<{
      message?: string;
    }>;

    expect(sanitized[0].message).toBe("nested boom");
    expect(sanitized[1]).toEqual({ ok: true });
  });
});

describe("sanitizeLogData depth cap", () => {
  it("replaces values past the depth cap with a sentinel string (not the original reference)", () => {
    // 9 levels of nesting - one past the depth cap of 8.
    const deep = {
      a: { b: { c: { d: { e: { f: { g: { h: { i: "leaf" } } } } } } } },
    };

    const sanitized = sanitizeLogData(deep) as { a: { b: { c: any } } };

    // The path up to depth 8 is preserved, but the value at depth 8
    // is the sentinel, not the original sub-object reference.
    expect(typeof sanitized.a.b.c.d.e.f.g.h).toBe("string");
    expect(sanitized.a.b.c.d.e.f.g.h).toBe("[MAX_DEPTH_EXCEEDED]");
  });

  it("does not let cyclic objects escape into the sanitized payload", () => {
    // obj.self = obj - the classic cyclic structure that would crash
    // JSON.stringify() and corrupt Sentry breadcrumbs / extras.
    const obj: Record<string, unknown> = { foo: "bar" };
    obj.self = obj;

    const sanitized = sanitizeLogData(obj);

    // Sentry will serialize the breadcrumb / extra payload via
    // JSON.stringify - if a cycle escaped, this would throw with
    // "Converting circular structure to JSON".
    expect(() => JSON.stringify(sanitized)).not.toThrow();
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

  it("formats apiFactory's no-response ApiError (status: 0) as 'Network error 0:', not 'Network error undefined:'", () => {
    // apiFactory throws ApiError with `status: 0` and
    // `isNetworkError: true` when axios sees no response. The fallback
    // chain in normalizeError must use `??` (not `||`) so the
    // numeric 0 is preserved and the captured Error.message tells the
    // truth about what failed.
    const apiError = {
      message: "Network Error",
      status: 0,
      isNetworkError: true,
    };
    const result = normalizeError(apiError);
    expect(result.message).toBe("Network error 0: Network Error");
  });
});
