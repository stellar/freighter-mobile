/**
 * Decode a base64 data-entry value to a printable UTF-8 string, else return the
 * base64 as-is.
 *
 * Data entry values are arbitrary bytes on-chain (opaque<64>), so both branches
 * are common. Decoding has to be strict: latin1 would turn multi-byte text into
 * mojibake that still looks printable and would render as if it had decoded
 * cleanly.
 *
 * Diverges from the browser extension deliberately. It uses
 * `new TextDecoder("utf-8", { fatal: true })`, relying on `fatal` to throw on
 * invalid UTF-8. That does not port: this app has no TextDecoder polyfill
 * installed, the `fast-text-encoding` package explicitly rejects the `fatal`
 * option, and `Buffer.toString("utf8")` substitutes U+FFFD rather than failing.
 * A round-trip byte comparison is exact where a U+FFFD scan would be a
 * heuristic — a legitimate U+FFFD in valid input must not be treated as a
 * failure.
 */

/** True when the text holds control characters, i.e. it isn't printable. */
const hasControlChars = (text: string) =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    if (code < 32) {
      // allow the whitespace controls (tab, LF, VT, FF, CR)
      return code < 9 || code > 13;
    }
    return code === 127 || (code >= 128 && code <= 159);
  });

export const decodeDataValue = (b64: string | null): string | null => {
  if (!b64) {
    return null;
  }

  try {
    const bytes = Buffer.from(b64, "base64");
    const decoded = bytes.toString("utf8");

    // Buffer's utf8 decode never throws — it substitutes U+FFFD. Re-encoding
    // and comparing bytes is what actually proves the input was valid UTF-8.
    if (!Buffer.from(decoded, "utf8").equals(bytes)) {
      return b64;
    }

    // ASCII control bytes are valid UTF-8, so binary can survive the decode.
    if (hasControlChars(decoded)) {
      return b64;
    }

    return decoded;
  } catch {
    return b64;
  }
};
