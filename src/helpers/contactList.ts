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
 * @param address - The federation address to resolve (e.g. "alice*stellar.org")
 * @param signal  - An AbortSignal to cancel the request early
 * @returns The federation server response containing `account_id`
 * @throws When the server is unreachable, the address doesn't exist, the
 *         request times out, or the signal is aborted
 */
export const resolveFederationAddress = (
  address: string,
  signal?: AbortSignal,
) =>
  Promise.race([
    Federation.Server.resolve(address),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Federation resolution timed out")),
        FEDERATION_TIMEOUT_MS,
      );
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      });
    }),
  ]);
