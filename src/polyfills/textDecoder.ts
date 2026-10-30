/**
 * Strict UTF-8 TextDecoder Polyfill for React Native (Hermes)
 *
 * Hermes ships no `TextDecoder`, so the app's global one comes from
 * `fast-text-encoding` (a direct dependency, also imported by
 * `@walletconnect/react-native-compat`). Its constructor throws "the 'fatal'
 * option is unsupported" whenever `{ fatal: true }` is passed, and its decoder
 * never validates its input. Node's TextDecoder supports `fatal`, so Jest never
 * sees the failure.
 *
 * The Stellar SDK (v17.4) asks for a strict decoder on three paths:
 *
 * - The bounded-fetch adapter decodes every response body with
 *   `new TextDecoder("utf-8", { fatal: true })`. `StellarToml.Resolver` and
 *   `Federation.Server` both go through it, so federation addresses failed to
 *   resolve and stellar.toml asset icons failed to load.
 * - `XdrString.toStringStrict()` sits behind `asStringOrBytes()` and so behind
 *   `scValToNative()` for symbols, strings and executable tags. It threw, and
 *   those values came back as raw bytes instead of strings.
 * - The SDK's WASM custom-section name parsing (`contract/utils`).
 *
 * This polyfill wraps the global decoder. A UTF-8 decoder built with
 * `{ fatal: true }` checks its input with `isValidUtf8()`, a WHATWG-conformant
 * strict validator, and throws a `TypeError` on malformed input, as the native
 * decoder does. It also follows the WHATWG byte order mark rule, which
 * `fast-text-encoding` never applies: unless `ignoreBOM` is set, it drops one
 * leading U+FEFF from its output. The SDK's bounded fetch builds its decoder
 * with the default `ignoreBOM`, so a stellar.toml or federation response that
 * starts with a BOM parses, as on Node. `XdrString.toStringStrict()` and the
 * WASM name parser pass `ignoreBOM: true` and keep the BOM. Every other decoder
 * is built and used exactly as before: same output, same errors, and a BOM
 * stays in the output, as `fast-text-encoding` leaves it.
 *
 * It is guarded: when `new TextDecoder("utf-8", { fatal: true })` already works
 * (Node/V8 in Jest, a future Hermes) it does nothing.
 *
 * Load order. `fast-text-encoding` only installs its decoder when the global is
 * missing, so this module requires it first instead of relying on the
 * WalletConnect compat import order, and the later import there stays a no-op.
 * `fast-text-encoding` also decodes through `Buffer` only if a global `Buffer`
 * exists when it loads, and bootstrap runs before shim.js installs one. Without
 * the `Buffer` assignment below it would silently fall back to a different
 * decoder for every caller in the app.
 */
import { Buffer as BufferPolyfill } from "buffer";

// The same assignment shim.js makes, only earlier: see "Load order" above.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill;
}

require("fast-text-encoding");

/** Raised by a fatal decoder, worded like the native decoder's own error. */
const INVALID_DATA_MESSAGE =
  "The encoded data was not valid for encoding utf-8";

/** Labels `fast-text-encoding` accepts for UTF-8, in any letter case. */
const UTF8_LABEL = /^(?:utf-?8|unicode-1-1-utf-8)$/i;

/** The byte order mark, U+FEFF, as a UTF-16 code unit. */
const BYTE_ORDER_MARK = 0xfeff;

/** The constructor options a decoder reads. */
interface DecoderOptions {
  fatal?: boolean;
  ignoreBOM?: boolean;
}

/** A decoder instance. The global `TextDecoder` is declared as a value only. */
type TextDecoderInstance = InstanceType<typeof TextDecoder>;

/** What `decode()` accepts as input. */
type DecodeInput = Parameters<TextDecoderInstance["decode"]>[0];

/**
 * Whether a TextDecoder label names UTF-8, the only encoding `isValidUtf8()`
 * can check. A missing label means UTF-8, as it does for `fast-text-encoding`.
 *
 * @param label - The label the decoder was built with.
 * @returns `true` for a UTF-8 label.
 */
const isUtf8Label = (label?: string | null): boolean =>
  UTF8_LABEL.test(label || "utf-8");

/**
 * Normalizes `decode()` input to a `Uint8Array` the way `fast-text-encoding`
 * does, so the bytes that are validated are the bytes it decodes. A missing
 * input is empty, as for the native decoder.
 *
 * @param input - An ArrayBuffer, a view over one, or nothing.
 * @returns The bytes to validate and decode.
 */
const toUint8Array = (input?: DecodeInput): Uint8Array => {
  if (input === undefined) {
    return new Uint8Array(0);
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  // Any other view, or an ArrayBuffer, which has no `buffer`. Like the base, a
  // `null` input throws a TypeError here.
  const view = input as Partial<ArrayBufferView>;
  return view.buffer instanceof ArrayBuffer
    ? new Uint8Array(view.buffer)
    : new Uint8Array(input as ArrayBuffer);
};

/**
 * Strictly validates UTF-8, following the WHATWG Encoding Standard's decoder.
 *
 * It rejects stray continuation bytes, the lead bytes 0xC0, 0xC1 and
 * 0xF5-0xFF, overlong 3- and 4-byte forms (0xE0 followed by less than 0xA0,
 * 0xF0 followed by less than 0x90), surrogates (0xED followed by 0xA0-0xBF),
 * code points above U+10FFFF (0xF4 followed by 0x90 or more) and truncated
 * sequences. It accepts every other well-formed sequence, including 4-byte
 * emoji, and a leading BOM.
 *
 * @param bytes - The encoded data to check.
 * @returns `true` when `bytes` is well-formed UTF-8.
 */
export const isValidUtf8 = (bytes: Uint8Array): boolean => {
  const { length } = bytes;
  let index = 0;

  while (index < length) {
    const lead = bytes[index];
    index += 1;

    if (lead >= 0x80) {
      // How many continuation bytes the lead byte announces, and the range that
      // the first of them may take. The narrowed ranges are what rule out the
      // overlong forms, the surrogates and anything above U+10FFFF.
      let continuations: number;
      let lower = 0x80;
      let upper = 0xbf;

      if (lead >= 0xc2 && lead <= 0xdf) {
        continuations = 1;
      } else if (lead >= 0xe0 && lead <= 0xef) {
        continuations = 2;
        if (lead === 0xe0) lower = 0xa0;
        if (lead === 0xed) upper = 0x9f;
      } else if (lead >= 0xf0 && lead <= 0xf4) {
        continuations = 3;
        if (lead === 0xf0) lower = 0x90;
        if (lead === 0xf4) upper = 0x8f;
      } else {
        // A stray continuation byte, 0xC0, 0xC1 or 0xF5-0xFF.
        return false;
      }

      if (index + continuations > length) {
        return false;
      }

      if (bytes[index] < lower || bytes[index] > upper) {
        return false;
      }

      for (let offset = 1; offset < continuations; offset += 1) {
        const continuation = bytes[index + offset];
        if (continuation < 0x80 || continuation > 0xbf) {
          return false;
        }
      }

      index += continuations;
    }
  }

  return true;
};

/**
 * Whether a TextDecoder constructor can build a strict UTF-8 decoder.
 *
 * @param TextDecoderConstructor - The constructor to probe.
 * @returns `true` when `new TextDecoderConstructor("utf-8", { fatal: true })`
 * does not throw.
 */
const supportsFatal = (TextDecoderConstructor: typeof TextDecoder): boolean => {
  try {
    return Boolean(new TextDecoderConstructor("utf-8", { fatal: true }));
  } catch {
    return false;
  }
};

/**
 * Builds a TextDecoder class that adds `fatal` support for UTF-8 on top of
 * `BaseTextDecoder`, which rejects it.
 *
 * @param BaseTextDecoder - The decoder to wrap, `fast-text-encoding`'s.
 * @returns A constructor to install as the global `TextDecoder`.
 */
const createFatalTextDecoder = (
  BaseTextDecoder: typeof TextDecoder,
): typeof TextDecoder => {
  /**
   * A TextDecoder that, when built with `fatal: true` for UTF-8, validates its
   * input and follows the byte order mark rule.
   */
  class FatalTextDecoder {
    readonly encoding: string;

    readonly fatal: boolean;

    readonly ignoreBOM: boolean;

    private readonly base: TextDecoderInstance;

    private readonly stripsBOM: boolean;

    /**
     * Builds the decoder. A UTF-8 decoder with `fatal` set strips `fatal` from
     * the options it gives the base, validates on its own and follows the
     * WHATWG byte order mark rule: its `ignoreBOM` is the option it honors. For
     * anything else the base gets the caller's arguments untouched, so a
     * non-fatal decoder behaves exactly as before (it never strips a BOM, and
     * `ignoreBOM` mirrors the base) and a non-UTF-8 `fatal` decoder is still
     * rejected, as before. `encoding` mirrors the base.
     *
     * @param label - The encoding label, `utf-8` when omitted.
     * @param options - The decoder options.
     */
    constructor(label?: string, options?: DecoderOptions | null) {
      const strict = Boolean(options?.fatal) && isUtf8Label(label);

      this.base = new BaseTextDecoder(
        label,
        (strict ? { ...options, fatal: false } : options) as
          | DecoderOptions
          | undefined,
      );
      this.encoding = this.base.encoding;
      this.fatal = strict;
      this.ignoreBOM = strict
        ? Boolean(options?.ignoreBOM)
        : this.base.ignoreBOM;
      this.stripsBOM = strict && !this.ignoreBOM;
    }

    /**
     * Decodes `input`. A non-fatal decoder hands the call straight to the base.
     * A fatal one decodes with the base too, so the base's own errors (such as
     * its unsupported `stream` option) surface unchanged, then throws a
     * `TypeError` if the bytes are not well-formed UTF-8. Unless `ignoreBOM` is
     * set it also drops one leading U+FEFF from the result, which the base
     * never does. Each call strips on its own, so one decoder can be reused.
     *
     * @param input - The encoded data. A fatal decoder reads a missing input as
     * empty, like the native decoder; a non-fatal one keeps the base's
     * behavior.
     * @param options - The decode options, passed to the base.
     * @returns The decoded string.
     * @throws `TypeError` when a fatal decoder gets malformed UTF-8.
     */
    decode(input?: DecodeInput, options?: { stream?: boolean }): string {
      if (!this.fatal) {
        return this.base.decode(input, options);
      }

      const bytes = toUint8Array(input);
      const text = this.base.decode(bytes, options);

      if (!isValidUtf8(bytes)) {
        throw new TypeError(INVALID_DATA_MESSAGE);
      }

      return this.stripsBOM && text.charCodeAt(0) === BYTE_ORDER_MARK
        ? text.slice(1)
        : text;
    }
  }

  return FatalTextDecoder as unknown as typeof TextDecoder;
};

/**
 * Makes `scope.TextDecoder` accept `{ fatal: true }` for UTF-8 by wrapping it.
 * It does nothing when the constructor already supports `fatal`, or when there
 * is no `TextDecoder` to wrap, so calling it again is safe.
 *
 * @param scope - The global object to patch.
 * @returns `true` when it wrapped the constructor, `false` when it changed
 * nothing.
 */
export const installFatalTextDecoder = (
  scope: typeof globalThis = globalThis,
): boolean => {
  const BaseTextDecoder = scope.TextDecoder as typeof TextDecoder | undefined;

  if (typeof BaseTextDecoder !== "function" || supportsFatal(BaseTextDecoder)) {
    return false;
  }

  // eslint-disable-next-line no-param-reassign
  scope.TextDecoder = createFatalTextDecoder(BaseTextDecoder);
  return true;
};

installFatalTextDecoder();
