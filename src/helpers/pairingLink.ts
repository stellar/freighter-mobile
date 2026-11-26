/** What a deep link means for WalletConnect pairing. */
export type PairingLinkResult =
  | { status: "ignored" }
  | { status: "invalid" }
  | { status: "valid"; uri: string };

/**
 * Reads the WalletConnect pairing URI from a deep link.
 *
 * - `ignored`: not one of our pairing links, or one without a `uri` value. A
 *   dApp opens the bare link to bring the wallet back to the foreground.
 * - `invalid`: one of our links that can't be parsed, or whose `uri` value
 *   isn't valid percent-encoding.
 * - `valid`: the decoded pairing URI.
 *
 * Decoding stays inside the `try`: `decodeURIComponent` throws on a malformed
 * escape such as `%FF`, and so does React Native's `URLSearchParams`.
 *
 * @param url - The link the app was opened with, if any
 * @param redirectLink - The wallet's own pairing link, e.g. `freighterwallet://wc-redirect`
 * @returns What the link means for pairing
 */
export const parsePairingLink = (
  url: string | null | undefined,
  redirectLink: string,
): PairingLinkResult => {
  if (!url || !url.includes(redirectLink)) {
    return { status: "ignored" };
  }

  try {
    const uriParam = new URL(url).search.split("uri=")[1];

    if (!uriParam) {
      return { status: "ignored" };
    }

    return { status: "valid", uri: decodeURIComponent(uriParam) };
  } catch {
    return { status: "invalid" };
  }
};
