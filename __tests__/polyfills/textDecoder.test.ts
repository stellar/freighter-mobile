/**
 * TextDecoder `fatal` Polyfill Tests
 *
 * Hermes has no native TextDecoder, so the app's global one is
 * `fast-text-encoding`, whose constructor throws "the 'fatal' option is
 * unsupported". Stellar SDK v17.4 builds `new TextDecoder("utf-8", { fatal:
 * true })` in its bounded-fetch adapter (stellar.toml and federation
 * resolution) and in `XdrString.toStringStrict()` (`scValToNative` for symbols
 * and strings), so those paths failed on device while passing in Jest, where
 * Node's native TextDecoder supports `fatal`.
 *
 * To reproduce Hermes, a test removes the native global, loads
 * `fast-text-encoding` so it installs its own decoder, and then loads the
 * polyfill under test. `afterEach` puts every global it touched back, so
 * nothing leaks into the other tests in this file.
 */
type PolyfillModule = typeof import("../../src/polyfills/textDecoder");
type StellarSdk = typeof import("@stellar/stellar-sdk");
type TextDecoderConstructor = typeof TextDecoder;
type SwappedGlobal = "TextDecoder" | "Buffer" | "fetch";

const NativeTextDecoder = globalThis.TextDecoder;
const savedGlobals = new Map<SwappedGlobal, PropertyDescriptor | undefined>();

/** Remembers a global's descriptor the first time it is touched. */
const saveGlobal = (name: SwappedGlobal) => {
  if (!savedGlobals.has(name)) {
    savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
};

/** Deletes a global, as if the runtime never provided it. */
const removeGlobal = (name: SwappedGlobal) => {
  saveGlobal(name);
  Reflect.deleteProperty(globalThis, name);
};

/** Replaces a global with a test double. */
const replaceGlobal = (name: SwappedGlobal, value: unknown) => {
  saveGlobal(name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

/** Puts back every global that a test removed or replaced. */
const restoreGlobals = () => {
  savedGlobals.forEach((descriptor, name) => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  });
  savedGlobals.clear();
};

/**
 * Reproduces Hermes: the native TextDecoder is gone, so `fast-text-encoding`
 * installs its own. Returns that constructor.
 */
const simulateHermes = (): TextDecoderConstructor => {
  removeGlobal("TextDecoder");
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    require("fast-text-encoding");
  });

  expect(globalThis.TextDecoder).not.toBe(NativeTextDecoder);
  return globalThis.TextDecoder;
};

/** Loads a fresh copy of the polyfill, which installs itself on the global. */
const loadPolyfill = (): PolyfillModule => {
  let polyfill!: PolyfillModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    polyfill = require("../../src/polyfills/textDecoder");
  });
  return polyfill;
};

/**
 * Loads a fresh copy of the SDK. The SDK caches its strict decoder in a module
 * variable, so each test that reaches that path needs its own copy.
 */
const loadSdk = (): StellarSdk => {
  let sdk!: StellarSdk;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    sdk = require("@stellar/stellar-sdk");
  });
  return sdk;
};

/** Returns what a call throws, failing the test if it does not throw. */
const thrownBy = (call: () => unknown): Error => {
  try {
    call();
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected the call to throw");
};

/** Formats bytes as space-separated hex pairs, to name a mismatching input. */
const hex = (bytes: ArrayLike<number>): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");

// ignoreBOM keeps a leading BOM in the output, so only validity can differ.
const nativeStrict = new NativeTextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

/** Whether Node's native strict decoder accepts the bytes. */
const nativeAccepts = (bytes: ArrayLike<number>): boolean => {
  try {
    nativeStrict.decode(Uint8Array.from(bytes));
    return true;
  } catch {
    return false;
  }
};

const VALID_SEQUENCES: Array<[string, number[]]> = [
  ["empty input", []],
  ["ASCII", [0x68, 0x65, 0x6c, 0x6c, 0x6f]],
  ["NUL and DEL", [0x00, 0x7f]],
  ["U+0080, the smallest 2-byte code point", [0xc2, 0x80]],
  ["U+07FF, the largest 2-byte code point", [0xdf, 0xbf]],
  ["U+0800, the smallest 3-byte code point", [0xe0, 0xa0, 0x80]],
  ["U+D7FF, just below the surrogates", [0xed, 0x9f, 0xbf]],
  ["U+E000, just above the surrogates", [0xee, 0x80, 0x80]],
  ["U+FFFF, the largest BMP code point", [0xef, 0xbf, 0xbf]],
  ["U+10000, the smallest 4-byte code point", [0xf0, 0x90, 0x80, 0x80]],
  ["U+1F642, a 4-byte emoji", [0xf0, 0x9f, 0x99, 0x82]],
  ["U+10FFFF, the largest code point", [0xf4, 0x8f, 0xbf, 0xbf]],
  ["a byte order mark before text", [0xef, 0xbb, 0xbf, 0x68]],
  [
    "mixed 1-, 2-, 3- and 4-byte characters",
    [0x61, 0xc3, 0xa7, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x99, 0x82, 0x7a],
  ],
];

const INVALID_SEQUENCES: Array<[string, number[]]> = [
  ["a lead byte that is never valid (0xff)", [0xff]],
  ["a truncated 3-byte sequence", [0xe2, 0x82]],
  ["an overlong 2-byte encoding (0xc0 0xaf)", [0xc0, 0xaf]],
  ["a UTF-16 surrogate (U+D800)", [0xed, 0xa0, 0x80]],
  ["a code point above U+10FFFF", [0xf4, 0x90, 0x80, 0x80]],
  ["a stray continuation byte", [0x80]],
  ["an overlong 2-byte encoding (0xc1 0xbf)", [0xc1, 0xbf]],
  ["an overlong 3-byte encoding", [0xe0, 0x9f, 0xbf]],
  ["an overlong 4-byte encoding", [0xf0, 0x8f, 0xbf, 0xbf]],
  ["the last surrogate (U+DFFF)", [0xed, 0xbf, 0xbf]],
  ["the lead byte 0xf5", [0xf5, 0x80, 0x80, 0x80]],
  ["a 5-byte form (0xf8)", [0xf8, 0x88, 0x80, 0x80, 0x80]],
  ["the lead byte 0xfe", [0xfe]],
  ["a truncated 2-byte sequence", [0xc3]],
  ["a truncated 4-byte sequence", [0xf0, 0x9f, 0x99]],
  ["a lead byte followed by ASCII", [0xc3, 0x41]],
  ["a 3-byte lead with an ASCII second byte", [0xe2, 0x41, 0x80]],
  ["a 3-byte sequence with an ASCII third byte", [0xe2, 0x82, 0x41]],
  ["a 3-byte sequence with a lead byte as the third byte", [0xe2, 0x82, 0xc0]],
  ["a 4-byte sequence with an ASCII third byte", [0xf0, 0x9f, 0x41, 0x82]],
  ["a 4-byte sequence with an ASCII fourth byte", [0xf0, 0x9f, 0x99, 0x41]],
  ["valid text and then a stray byte", [0x68, 0x69, 0x80]],
  ["valid text and then a truncated sequence", [0x68, 0xe2, 0x82]],
];

describe("TextDecoder fatal polyfill", () => {
  afterEach(restoreGlobals);

  describe("isValidUtf8", () => {
    let isValidUtf8: PolyfillModule["isValidUtf8"];

    beforeAll(() => {
      ({ isValidUtf8 } = loadPolyfill());
    });

    it.each(VALID_SEQUENCES)("accepts %s", (_name, bytes) => {
      expect(nativeAccepts(bytes)).toBe(true);
      expect(isValidUtf8(Uint8Array.from(bytes))).toBe(true);
    });

    it.each(INVALID_SEQUENCES)("rejects %s", (_name, bytes) => {
      expect(nativeAccepts(bytes)).toBe(false);
      expect(isValidUtf8(Uint8Array.from(bytes))).toBe(false);
    });

    it("agrees with Node's native strict decoder on sampled inputs", () => {
      const mismatches: string[] = [];
      const compare = (bytes: number[]) => {
        if (isValidUtf8(Uint8Array.from(bytes)) !== nativeAccepts(bytes)) {
          mismatches.push(hex(bytes));
        }
      };

      // Every 1- and 2-byte input.
      for (let first = 0; first < 256; first += 1) {
        compare([first]);
        for (let second = 0; second < 256; second += 1) {
          compare([first, second]);
        }
      }

      // Every possible second byte after each 3- and 4-byte lead, with the
      // edges of the continuation range (0x80-0xbf) for the later bytes.
      const edges = [0x7f, 0x80, 0xbf, 0xc0];
      for (let lead = 0xe0; lead <= 0xf7; lead += 1) {
        for (let second = 0; second < 256; second += 1) {
          edges.forEach((third) => {
            compare([lead, second, third]);
            if (lead >= 0xf0) {
              edges.forEach((fourth) => compare([lead, second, third, fourth]));
            }
          });
        }
      }

      // Pseudo-random mixes of valid and invalid bytes, from a fixed seed.
      const pool = [
        0x00, 0x41, 0x7f, 0x80, 0xbf, 0xc0, 0xc2, 0xdf, 0xe0, 0xe2, 0xed, 0xef,
        0xf0, 0xf4, 0xf5, 0xff, 0x82, 0xac, 0xa0, 0x9f, 0x90, 0x8f,
      ];
      let seed = 123456789;
      const next = (limit: number) => {
        seed = (seed * 48271) % 2147483647;
        return seed % limit;
      };
      for (let round = 0; round < 20000; round += 1) {
        const bytes = Array.from(
          { length: next(9) },
          () => pool[next(pool.length)],
        );
        compare(bytes);
      }

      expect(mismatches).toEqual([]);
    });
  });

  describe("under Hermes (fast-text-encoding is the global TextDecoder)", () => {
    it("rejects { fatal: true } without the polyfill, which is the failure on device", () => {
      simulateHermes();

      expect(() => new TextDecoder("utf-8", { fatal: true })).toThrow(
        /'fatal' option is unsupported/,
      );
    });

    describe("with the polyfill loaded", () => {
      let BaseTextDecoder: TextDecoderConstructor;

      beforeEach(() => {
        BaseTextDecoder = simulateHermes();
        loadPolyfill();
      });

      it("replaces the global with a decoder that accepts { fatal: true }", () => {
        expect(globalThis.TextDecoder).not.toBe(BaseTextDecoder);

        const decoder = new TextDecoder("utf-8", { fatal: true });

        expect(decoder.fatal).toBe(true);
        expect(decoder.encoding).toBe("utf-8");
      });

      it.each([
        ["ASCII", "hello, world"],
        ["Latin-1 letters", "çãé"],
        ["a euro sign", "€"],
        ["an emoji outside the BMP", "🙂"],
      ])("decodes %s exactly like the native decoder", (_name, text) => {
        const bytes = new TextEncoder().encode(text);
        const native = new NativeTextDecoder("utf-8", { fatal: true });

        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

        expect(decoded).toBe(native.decode(bytes));
        expect(decoded).toBe(text);
      });

      it("accepts an ArrayBuffer, a Uint8Array view and no argument", () => {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const bytes = new TextEncoder().encode("çãé");

        expect(decoder.decode(bytes.slice().buffer)).toBe("çãé");
        expect(decoder.decode(bytes.subarray(2))).toBe("ãé");
        expect(decoder.decode()).toBe("");
      });

      it("decodes only the bytes a view covers, like the native decoder", () => {
        // "é€" with an invalid byte (0xff) on each side. The view covers only
        // the text, so a decoder that reads the whole buffer would throw.
        const text = new TextEncoder().encode("é€");
        const buf = Uint8Array.from([0xff, ...text, 0xff]).buffer;
        const view = new DataView(buf, 1, text.length);
        const options = { fatal: true };
        const decoder = new TextDecoder("utf-8", options);

        expect(nativeAccepts(new Uint8Array(buf))).toBe(false);
        expect(() => decoder.decode(view)).not.toThrow();
        expect(decoder.decode(view)).toBe("é€");
        expect(decoder.decode(view)).toBe(
          new NativeTextDecoder("utf-8", options).decode(view),
        );
      });

      it.each(INVALID_SEQUENCES)(
        "throws a TypeError for %s",
        (_name, bytes) => {
          const decoder = new TextDecoder("utf-8", { fatal: true });
          const input = Uint8Array.from(bytes);

          // The native decoder's TypeError comes from Node's realm, so Jest's
          // instanceof check cannot match it; confirm the bytes are invalid.
          expect(nativeAccepts(bytes)).toBe(false);
          expect(() => decoder.decode(input)).toThrow(TypeError);
          expect(() => decoder.decode(input)).toThrow(
            "The encoded data was not valid for encoding utf-8",
          );
        },
      );

      it("accepts the utf8 alias and any letter case for the label", () => {
        const bytes = new TextEncoder().encode("€");

        expect(new TextDecoder("utf8", { fatal: true }).decode(bytes)).toBe(
          "€",
        );
        expect(new TextDecoder("UTF-8", { fatal: true }).decode(bytes)).toBe(
          "€",
        );
      });

      it("keeps the base's rejection of { fatal: true } for labels other than UTF-8", () => {
        const expected = thrownBy(
          () => new BaseTextDecoder("ascii", { fatal: true }),
        );

        expect(
          thrownBy(() => new TextDecoder("ascii", { fatal: true })),
        ).toEqual(expected);
        expect(expected.message).toMatch(/'fatal' option is unsupported/);
      });

      it("returns what fast-text-encoding returns for a non-fatal decoder", () => {
        const bytes = Uint8Array.from([0x68, 0xff, 0x69]);
        const base = new BaseTextDecoder();
        const decoder = new TextDecoder();

        expect(decoder.decode(bytes)).toBe(base.decode(bytes));
        expect(decoder.encoding).toBe(base.encoding);
        expect(decoder.ignoreBOM).toBe(base.ignoreBOM);
        expect(decoder.fatal).toBe(false);
      });

      it("treats { fatal: false }, no options and null options like the base", () => {
        const bytes = Uint8Array.from([0x68, 0xff, 0x69]);
        const expected = new BaseTextDecoder().decode(bytes);

        expect(new TextDecoder("utf-8", { fatal: false }).decode(bytes)).toBe(
          expected,
        );
        expect(new TextDecoder("utf-8", undefined).decode(bytes)).toBe(
          expected,
        );
        expect(new TextDecoder("utf-8", null as never).decode(bytes)).toBe(
          expected,
        );
      });

      it("keeps the base's errors for non-fatal decoders", () => {
        const bytes = Uint8Array.from([0x68, 0x69]);

        expect(
          thrownBy(() => new TextDecoder().decode(bytes, { stream: true })),
        ).toEqual(
          thrownBy(() => new BaseTextDecoder().decode(bytes, { stream: true })),
        );
        expect(thrownBy(() => new TextDecoder("nope"))).toEqual(
          thrownBy(() => new BaseTextDecoder("nope")),
        );
        expect(thrownBy(() => new TextDecoder("nope"))).toBeInstanceOf(
          RangeError,
        );
        // The one input where a fatal decoder differs on purpose: it reads a
        // missing input as empty, and a non-fatal one keeps the base's error.
        expect(thrownBy(() => new TextDecoder().decode())).toEqual(
          thrownBy(() => new BaseTextDecoder().decode()),
        );
      });

      describe("byte order mark", () => {
        // A UTF-8 byte order mark (U+FEFF) followed by "hi".
        const BOM_THEN_TEXT = Uint8Array.from([0xef, 0xbb, 0xbf, 0x68, 0x69]);

        it("strips a leading BOM from a fatal decoder by default, like the native decoder", () => {
          const options = { fatal: true };

          const decoded = new TextDecoder("utf-8", options).decode(
            BOM_THEN_TEXT,
          );

          expect(decoded).toBe("hi");
          expect(decoded).toBe(
            new NativeTextDecoder("utf-8", options).decode(BOM_THEN_TEXT),
          );
        });

        it("keeps the BOM when a fatal decoder is built with ignoreBOM, like the native decoder", () => {
          const options = { fatal: true, ignoreBOM: true };

          const decoded = new TextDecoder("utf-8", options).decode(
            BOM_THEN_TEXT,
          );

          expect(decoded).toBe("\uFEFFhi");
          expect(decoded).toBe(
            new NativeTextDecoder("utf-8", options).decode(BOM_THEN_TEXT),
          );
        });

        it("leaves a non-fatal decoder's output as fast-text-encoding alone returns it", () => {
          const expected = new BaseTextDecoder().decode(BOM_THEN_TEXT);

          // The base never strips a BOM, whatever the options say.
          expect(expected).toBe("\uFEFFhi");
          expect(new TextDecoder().decode(BOM_THEN_TEXT)).toBe(expected);
          expect(
            new TextDecoder("utf-8", { fatal: false }).decode(BOM_THEN_TEXT),
          ).toBe(expected);
          expect(
            new TextDecoder("utf-8", { ignoreBOM: false }).decode(
              BOM_THEN_TEXT,
            ),
          ).toBe(expected);
          expect(
            new TextDecoder("utf-8", { ignoreBOM: true }).decode(BOM_THEN_TEXT),
          ).toBe(expected);
        });

        it("strips only one leading BOM, like the native decoder", () => {
          const options = { fatal: true };
          const twoBoms = Uint8Array.from([
            0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, 0x68,
          ]);

          const decoded = new TextDecoder("utf-8", options).decode(twoBoms);

          expect(decoded).toBe("\uFEFFh");
          expect(decoded).toBe(
            new NativeTextDecoder("utf-8", options).decode(twoBoms),
          );
        });

        it("strips the BOM on every decode of one decoder, which the SDK reuses", () => {
          const decoder = new TextDecoder("utf-8", { fatal: true });

          expect(decoder.decode(BOM_THEN_TEXT)).toBe("hi");
          expect(decoder.decode(BOM_THEN_TEXT)).toBe("hi");
          expect(decoder.decode(BOM_THEN_TEXT.slice().buffer)).toBe("hi");
          expect(decoder.decode(Uint8Array.from([0x68]))).toBe("h");
        });

        it.each([
          ["only a BOM", [0xef, 0xbb, 0xbf]],
          ["a BOM that is not leading", [0x68, 0xef, 0xbb, 0xbf, 0x69]],
          ["a BOM at the very end", [0x68, 0xef, 0xbb, 0xbf]],
          [
            "a BOM before a 4-byte character",
            [0xef, 0xbb, 0xbf, 0xf0, 0x9f, 0x99, 0x82],
          ],
          ["U+FFFE, which is not a BOM", [0xef, 0xbf, 0xbe, 0x68]],
          ["no BOM", [0x68, 0x69]],
          ["empty input", []],
        ])(
          "matches the native decoder for %s, with and without ignoreBOM",
          (_name, bytes) => {
            const input = Uint8Array.from(bytes);

            [{ fatal: true }, { fatal: true, ignoreBOM: true }].forEach(
              (options) => {
                expect(new TextDecoder("utf-8", options).decode(input)).toBe(
                  new NativeTextDecoder("utf-8", options).decode(input),
                );
              },
            );
          },
        );

        it("reports ignoreBOM on a fatal decoder like the native decoder", () => {
          const defaults = new TextDecoder("utf-8", { fatal: true });
          const keeping = new TextDecoder("utf-8", {
            fatal: true,
            ignoreBOM: true,
          });

          expect(defaults.ignoreBOM).toBe(false);
          expect(keeping.ignoreBOM).toBe(true);
        });
      });

      it("surfaces the base's unsupported-stream error from a fatal decoder", () => {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const bytes = Uint8Array.from([0xe2, 0x82]);

        expect(() => decoder.decode(bytes, { stream: true })).toThrow(
          /'stream' option is unsupported/,
        );
      });
    });

    it("installs fast-text-encoding itself, without relying on another import", () => {
      removeGlobal("TextDecoder");

      loadPolyfill();

      const decoder = new TextDecoder("utf-8", { fatal: true });
      expect(decoder.decode(new TextEncoder().encode("🙂"))).toBe("🙂");
      expect(() => decoder.decode(Uint8Array.from([0xff]))).toThrow(TypeError);
    });

    it("installs Buffer before fast-text-encoding loads, as shim.js does later", () => {
      // bootstrap.js runs before shim.js sets up Buffer. fast-text-encoding
      // binds to a global Buffer when it loads: with one, it decodes through
      // Buffer and replaces invalid bytes with U+FFFD; without one, it falls
      // back to a different decoder that drops them.
      removeGlobal("Buffer");
      removeGlobal("TextDecoder");

      loadPolyfill();

      expect(typeof Buffer).toBe("function");
      expect(
        new TextDecoder().decode(Uint8Array.from([0x68, 0xff, 0x69])),
      ).toBe("h\uFFFDi");
    });
  });

  describe("installFatalTextDecoder", () => {
    it("does nothing and returns false when TextDecoder already supports fatal", () => {
      const { installFatalTextDecoder } = loadPolyfill();

      expect(globalThis.TextDecoder).toBe(NativeTextDecoder);
      expect(installFatalTextDecoder()).toBe(false);
      expect(globalThis.TextDecoder).toBe(NativeTextDecoder);
    });

    it("returns false when there is no TextDecoder", () => {
      const { installFatalTextDecoder } = loadPolyfill();
      const scope = {} as typeof globalThis;

      expect(installFatalTextDecoder(scope)).toBe(false);
      expect(scope.TextDecoder).toBeUndefined();
    });

    it("wraps a TextDecoder that rejects fatal and returns true", () => {
      const BaseTextDecoder = simulateHermes();
      const { installFatalTextDecoder } = loadPolyfill();
      const scope = { TextDecoder: BaseTextDecoder } as typeof globalThis;

      expect(installFatalTextDecoder(scope)).toBe(true);

      expect(scope.TextDecoder).not.toBe(BaseTextDecoder);
      expect(
        new scope.TextDecoder("utf-8", { fatal: true }).decode(
          new TextEncoder().encode("€"),
        ),
      ).toBe("€");
    });

    it("does not wrap twice", () => {
      const BaseTextDecoder = simulateHermes();
      const { installFatalTextDecoder } = loadPolyfill();
      const wrapped = globalThis.TextDecoder;

      expect(wrapped).not.toBe(BaseTextDecoder);
      expect(installFatalTextDecoder()).toBe(false);
      expect(globalThis.TextDecoder).toBe(wrapped);
    });
  });

  describe("in the Stellar SDK under Hermes", () => {
    it("returns bytes without the polyfill and strings with it from scValToNative", () => {
      simulateHermes();
      const { scValToNative, xdr } = loadSdk();
      const symbol = xdr.ScVal.scvSymbol("transfer");
      const text = xdr.ScVal.scvString("héllo 🙂");

      // toStringStrict() throws, so asStringOrBytes() falls back to the bytes.
      expect(scValToNative(symbol)).toBeInstanceOf(Uint8Array);
      expect(scValToNative(text)).toBeInstanceOf(Uint8Array);

      loadPolyfill();

      expect(scValToNative(symbol)).toBe("transfer");
      expect(scValToNative(text)).toBe("héllo 🙂");
    });

    it("keeps a leading BOM in strings, as XdrString asks for", () => {
      simulateHermes();
      loadPolyfill();
      const { scValToNative, xdr } = loadSdk();

      // XdrString.toStringStrict() builds its decoder with ignoreBOM: true.
      expect(scValToNative(xdr.ScVal.scvString("\uFEFFhi"))).toBe("\uFEFFhi");
    });

    describe("bounded fetch", () => {
      const FEDERATION_SERVER = "https://example.com/federation";
      const ACCOUNT_ID =
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const STELLAR_TOML = `FEDERATION_SERVER = ${JSON.stringify(FEDERATION_SERVER)}
ACCOUNT_RECORD = ${JSON.stringify("é €")}
`;

      /** Answers every request from `bodyFor`, so no network is touched. */
      const serve = (bodyFor: (url: string) => string | Uint8Array) =>
        replaceGlobal(
          "fetch",
          jest.fn((url: string) => Promise.resolve(new Response(bodyFor(url)))),
        );

      /**
       * A stellar.toml that names a federation server, which has a record. Both
       * responses start with `prefix`.
       */
      const serveFederation = (prefix = "") =>
        serve((url) =>
          url.includes("/.well-known/stellar.toml")
            ? `${prefix}${STELLAR_TOML}`
            : `${prefix}${JSON.stringify({ account_id: ACCOUNT_ID })}`,
        );

      it("fails to resolve stellar.toml without the polyfill", async () => {
        simulateHermes();
        serve(() => STELLAR_TOML);
        const { StellarToml } = loadSdk();

        // The SDK builds its strict decoder outside its try/catch, so the
        // constructor's error surfaces as it is.
        await expect(
          StellarToml.Resolver.resolve("example.com"),
        ).rejects.toThrow(/'fatal' option is unsupported/);
      });

      it("resolves stellar.toml with the polyfill", async () => {
        simulateHermes();
        loadPolyfill();
        serve(() => STELLAR_TOML);
        const { StellarToml } = loadSdk();

        await expect(
          StellarToml.Resolver.resolve("example.com"),
        ).resolves.toEqual({
          FEDERATION_SERVER,
          ACCOUNT_RECORD: "é €",
        });
      });

      it("resolves a stellar.toml that starts with a BOM with the polyfill", async () => {
        simulateHermes();
        loadPolyfill();
        serve(() => `\uFEFF${STELLAR_TOML}`);
        const { StellarToml } = loadSdk();

        // The SDK's decoder keeps the default ignoreBOM, so the BOM is dropped
        // before smol-toml parses the text, as it is on Node.
        await expect(
          StellarToml.Resolver.resolve("example.com"),
        ).resolves.toEqual({
          FEDERATION_SERVER,
          ACCOUNT_RECORD: "é €",
        });
      });

      it("rejects a body that is not valid UTF-8 with the SDK's own error", async () => {
        simulateHermes();
        loadPolyfill();
        serve(() => Uint8Array.from([0x41, 0xff, 0x42]));
        const { StellarToml } = loadSdk();

        await expect(
          StellarToml.Resolver.resolve("example.com"),
        ).rejects.toThrow("Response body is not valid UTF-8");
      });

      it("fails to resolve a federation address without the polyfill", async () => {
        simulateHermes();
        serveFederation();
        const { Federation } = loadSdk();

        await expect(
          Federation.Server.resolve("alice*example.com"),
        ).rejects.toThrow(/'fatal' option is unsupported/);
      });

      it("resolves a federation address with the polyfill", async () => {
        simulateHermes();
        loadPolyfill();
        serveFederation();
        const { Federation } = loadSdk();

        await expect(
          Federation.Server.resolve("alice*example.com"),
        ).resolves.toEqual({ account_id: ACCOUNT_ID });
      });

      it("resolves a federation address when both responses start with a BOM", async () => {
        simulateHermes();
        loadPolyfill();
        serveFederation("\uFEFF");
        const { Federation } = loadSdk();

        await expect(
          Federation.Server.resolve("alice*example.com"),
        ).resolves.toEqual({ account_id: ACCOUNT_ID });
      });
    });
  });
});

export {};
