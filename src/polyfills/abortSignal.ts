/**
 * AbortSignal static-method Polyfill for React Native (Hermes)
 *
 * Hermes implements `AbortController`/`AbortSignal` but not the static helpers
 * `AbortSignal.timeout()` and `AbortSignal.any()`. The Stellar SDK (v16+) routes
 * HTTP through `feaxios`, whose `handleFetch` calls both — and `submitTransaction`
 * is the only request that passes a `timeout`, so every transaction submit threw
 * "undefined is not a function" while GET requests (balances/history) worked.
 *
 * Each method is guarded so this no-ops on runtimes that already provide them.
 *
 * The project's TypeScript lib does not declare these newer members, so we view
 * the globals through local shims rather than relying on the DOM lib types.
 */

interface AbortControllerLike {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}

type AbortSignalLike = AbortSignal & { readonly reason: unknown };

type AbortSignalStatics = {
  timeout?: (milliseconds: number) => AbortSignal;
  any?: (signals: Iterable<AbortSignal>) => AbortSignal;
};

const AbortSignalCtor = AbortSignal as unknown as AbortSignalStatics;

// Abort reason for timeouts, matching the web spec's TimeoutError where possible.
const makeTimeoutReason = (): unknown => {
  if (typeof DOMException === "function") {
    return new DOMException("The operation timed out.", "TimeoutError");
  }

  const error = new Error("The operation timed out.");
  error.name = "TimeoutError";
  return error;
};

if (typeof AbortSignal !== "undefined") {
  if (typeof AbortSignalCtor.timeout !== "function") {
    AbortSignalCtor.timeout = (milliseconds: number): AbortSignal => {
      const controller =
        new AbortController() as unknown as AbortControllerLike;
      setTimeout(() => controller.abort(makeTimeoutReason()), milliseconds);
      return controller.signal;
    };
  }

  if (typeof AbortSignalCtor.any !== "function") {
    AbortSignalCtor.any = (signals: Iterable<AbortSignal>): AbortSignal => {
      const controller =
        new AbortController() as unknown as AbortControllerLike;
      const signalArray = Array.from(signals) as AbortSignalLike[];
      const alreadyAborted = signalArray.find((signal) => signal.aborted);

      if (alreadyAborted) {
        controller.abort(alreadyAborted.reason);
      } else {
        signalArray.forEach((signal) => {
          signal.addEventListener(
            "abort",
            () => controller.abort(signal.reason),
            { once: true },
          );
        });
      }

      return controller.signal;
    };
  }
}

export {};
