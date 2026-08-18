/**
 * AbortSignal static-method Polyfill Tests
 *
 * Hermes lacks AbortSignal.timeout() and AbortSignal.any(). The Stellar SDK's
 * feaxios HTTP client calls both, which broke every transaction submit with
 * "undefined is not a function" (Sentry FREIGHTER-MOBILE-YN).
 *
 * Jest (V8/Node) already provides these natively, so each test deletes them
 * first to reproduce the Hermes gap, then loads the polyfill and asserts it
 * restores the missing behavior.
 *
 * The project's TypeScript lib does not declare these members, so we view the
 * AbortSignal constructor through a local shim type.
 */
type AbortSignalStatics = {
  timeout?: (ms: number) => AbortSignal;
  any?: (signals: Iterable<AbortSignal>) => AbortSignal;
  abort: (reason?: unknown) => AbortSignal;
};

const statics = AbortSignal as unknown as AbortSignalStatics;
const reasonOf = (signal: AbortSignal): unknown =>
  (signal as AbortSignal & { reason: unknown }).reason;

const loadPolyfill = () => {
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    require("../../src/polyfills/abortSignal");
  });
};

describe("AbortSignal polyfill", () => {
  const originalTimeout = statics.timeout;
  const originalAny = statics.any;

  afterEach(() => {
    statics.timeout = originalTimeout;
    statics.any = originalAny;
    jest.useRealTimers();
  });

  it("installs AbortSignal.timeout when missing", () => {
    delete statics.timeout;
    expect(statics.timeout).toBeUndefined();

    loadPolyfill();

    expect(typeof statics.timeout).toBe("function");
  });

  it("AbortSignal.timeout returns a signal that aborts after the delay", () => {
    jest.useFakeTimers();
    delete statics.timeout;
    loadPolyfill();

    const signal = statics.timeout!(1000);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);

    jest.advanceTimersByTime(1000);

    expect(signal.aborted).toBe(true);
    expect((reasonOf(signal) as Error).name).toBe("TimeoutError");
  });

  it("installs AbortSignal.any when missing", () => {
    delete statics.any;
    expect(statics.any).toBeUndefined();

    loadPolyfill();

    expect(typeof statics.any).toBe("function");
  });

  it("AbortSignal.any aborts when one of its inputs aborts", () => {
    delete statics.any;
    loadPolyfill();

    const controller = new AbortController() as AbortController & {
      abort: (reason?: unknown) => void;
    };
    const combined = statics.any!([controller.signal]);
    expect(combined.aborted).toBe(false);

    controller.abort(new Error("boom"));

    expect(combined.aborted).toBe(true);
    expect((reasonOf(combined) as Error).message).toBe("boom");
  });

  it("AbortSignal.any aborts immediately if an input is already aborted", () => {
    delete statics.any;
    loadPolyfill();

    const combined = statics.any!([statics.abort(new Error("pre"))]);

    expect(combined.aborted).toBe(true);
  });

  it("does not override existing native implementations", () => {
    const sentinelTimeout = originalTimeout;
    loadPolyfill();

    expect(statics.timeout).toBe(sentinelTimeout);
  });
});
