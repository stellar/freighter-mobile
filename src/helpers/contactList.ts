import { Federation } from "@stellar/stellar-sdk";

const FEDERATION_TIMEOUT_MS = 10_000;

// Strip bidi control characters and zero-width characters that enable visual
// spoofing — critical in a wallet context where contact names guide sends.
const BIDI_AND_ZW_RE =
  // eslint-disable-next-line no-control-regex
  /[\u200B-\u200F\u2028-\u202F\u2060-\u2069\uFEFF\u00AD]/g;

export const sanitizeName = (value: string) =>
  value.replace(BIDI_AND_ZW_RE, "");

/**
 * Resolves a federation address with a hard timeout and AbortController support.
 * Prevents the UI from hanging indefinitely when a federation server is
 * unresponsive, and allows callers to cancel in-flight requests.
 *
 * Note: aborting the signal prevents the resolved value from being used but
 * does not cancel the underlying network request made by Federation.Server.resolve.
 *
 * @param address - The federation address to resolve (e.g. "alice*stellar.org")
 * @param signal  - An AbortSignal to cancel the request early
 * @returns The federation server response containing `account_id`
 * @throws When the server is unreachable, the address doesn't exist, the
 *         request times out, or the signal is aborted
 */
export const resolveFederationAddress = (
  address: string,
  signal?: AbortSignal,
): ReturnType<typeof Federation.Server.resolve> => {
  if (signal?.aborted) {
    return Promise.reject(new Error("Aborted"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
      fn();
    };

    onAbort = () => settle(() => reject(new Error("Aborted")));

    timer = setTimeout(
      () => settle(() => reject(new Error("Federation resolution timed out"))),
      FEDERATION_TIMEOUT_MS,
    );

    signal?.addEventListener("abort", onAbort);

    Federation.Server.resolve(address).then(
      (result) => settle(() => resolve(result)),
      (err) => settle(() => reject(err)),
    );
  });
};
