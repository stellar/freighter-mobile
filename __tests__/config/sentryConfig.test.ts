/* eslint-disable @fnando/consistent-import/consistent-import */
import type { ErrorEvent } from "@sentry/core";
import * as Sentry from "@sentry/react-native";
import {
  PASSWORD_TYPO_MESSAGES,
  initializeSentry,
  scrubStrKeys,
} from "config/sentryConfig";

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock("helpers/isEnv", () => ({
  isProd: false,
  isE2ETest: false,
}));

jest.mock("react-native-device-info", () => ({
  getVersion: jest.fn(() => "1.0.0"),
  getBuildNumber: jest.fn(() => "1"),
  getBundleId: jest.fn(() => "org.stellar.freighterwallet"),
}));

jest.mock("ducks/analytics", () => ({
  useAnalyticsStore: { getState: () => ({ isEnabled: true }) },
}));
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: {
    getState: () => ({ network: "PUBLIC", account: { publicKey: "GA..." } }),
  },
}));
jest.mock("ducks/networkInfo", () => ({
  useNetworkStore: {
    getState: () => ({ connectionType: "wifi", effectiveType: "4g" }),
  },
}));

const mockedSentry = Sentry as jest.Mocked<typeof Sentry>;

/**
 * Drive the configured beforeSend through a synthetic event whose
 * exception value is `message`. Returns whatever beforeSend returns
 * (the event object if passed through, null if dropped).
 */
const runBeforeSend = (message: string): ErrorEvent | null => {
  // Capture the beforeSend callback from the Sentry.init invocation.
  initializeSentry();
  const initOpts = mockedSentry.init.mock.calls[0]?.[0];
  if (!initOpts?.beforeSend) {
    throw new Error("beforeSend not configured");
  }
  const event: ErrorEvent = {
    type: undefined,
    exception: { values: [{ type: "Error", value: message }] },
  } as unknown as ErrorEvent;
  // The hint argument is unused by the filter logic; pass an empty obj.
  return initOpts.beforeSend(event, {}) as ErrorEvent | null;
};

/**
 * Drive beforeSend with a fully-shaped synthetic event so we can
 * assert scrub behavior on event.message, event.exception values,
 * and event.extra.message simultaneously.
 */
const runBeforeSendWith = (event: Partial<ErrorEvent>): ErrorEvent | null => {
  initializeSentry();
  const initOpts = mockedSentry.init.mock.calls[0]?.[0];
  if (!initOpts?.beforeSend) {
    throw new Error("beforeSend not configured");
  }
  return initOpts.beforeSend(event as ErrorEvent, {}) as ErrorEvent | null;
};

describe("sentryConfig.beforeSend filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("dropped patterns (no Sentry event, no breadcrumb)", () => {
    it.each([
      ["Error: Missing or invalid. Record was recently deleted - request: 123"],
      ["Error: Missing or invalid. Record was recently deleted - session: abc"],
    ])("drops WalletConnect 'Record was recently deleted' (%s)", (msg) => {
      expect(runBeforeSend(msg)).toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it.each([
      ['Error Domain=com.apple.LocalAuthentication Code=-4 "Canceled"'],
      ['Error Domain=com.apple.LocalAuthentication Code=-1003 "Timeout"'],
      ['Error Domain=com.apple.LocalAuthentication Code=-1004 "Foreground"'],
      ['Error Domain=com.apple.LocalAuthentication Code=6 "(null)"'],
    ])("drops iOS LocalAuthentication cancellation %s", (msg) => {
      expect(runBeforeSend(msg)).toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it("does NOT drop other LocalAuthentication codes (e.g. unknown new code)", () => {
      // A future iOS version might introduce Code=-99 - we shouldn't
      // silently swallow that; better to learn about it.
      const result = runBeforeSend(
        'Error Domain=com.apple.LocalAuthentication Code=-99 "Future code"',
      );
      expect(result).not.toBeNull();
    });

    it.each([
      ["Error: Fingerprint operation canceled."],
      ["Error: Fingerprint operation cancelled."],
      ["error: FINGERPRINT OPERATION CANCELLED"],
    ])("drops Android biometric cancellations %s", (msg) => {
      expect(runBeforeSend(msg)).toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe("breadcrumb-downgrade patterns (drop event, add breadcrumb)", () => {
    it.each(PASSWORD_TYPO_MESSAGES.map((m) => [m]))(
      "downgrades the user-typo password message %s to a breadcrumb",
      (message) => {
        expect(runBeforeSend(message)).toBeNull();
        expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
          expect.objectContaining({
            category: "user-input-validation",
            level: "warning",
          }),
        );
      },
    );

    it("does NOT drop the corruption signal 'Invalid password or corrupted data.'", () => {
      // encryptPassword.ts throws this exact message when decryption
      // fails - real signal of storage loss / data corruption, must
      // not be swallowed by the user-typo filter.
      const result = runBeforeSend("Invalid password or corrupted data.");
      expect(result).not.toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it("downgrades 'No stored password found for biometric authentication' to a breadcrumb", () => {
      expect(
        runBeforeSend(
          "Error: No stored password found for biometric authentication",
        ),
      ).toBeNull();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "biometric-state",
          level: "warning",
        }),
      );
    });
  });

  describe("real errors pass through", () => {
    it.each([
      ["Error: Private key not found"],
      ["TypeError: Cannot read property 'foo' of undefined"],
      ["Error: Network error 504: Request failed with status code 504"],
      ["Error: Failed to set key 0.123: User canceled the operation."],
      ["Error: WalletConnect transaction request origin does not match"],
      // bip39's "Invalid mnemonic" - the verifyMnemonicPhrase path
      // logs at warn (no Sentry event), so any "Invalid mnemonic"
      // event reaching beforeSend is from a post-validation path
      // (e.g. corrupted stored mnemonic) and is a real signal.
      ["Invalid mnemonic"],
    ])("does NOT filter real error %s", (msg) => {
      const result = runBeforeSend(msg);
      expect(result).not.toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe("network timeouts (post-removal of the explicit filter)", () => {
    // After removal of the timeout filter to preserve backend latency
    // visibility, axios timeouts should pass through to Sentry as
    // regular errors. This test pins that behavior.
    it("does NOT filter 'timeout of 15000ms exceeded'", () => {
      const result = runBeforeSend("Error: timeout of 15000ms exceeded");
      expect(result).not.toBeNull();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe("scrubStrKeys (Stellar StrKey identifier scrubber)", () => {
    // Real-shape Stellar StrKey samples for the regex (G/S + 55 base32).
    const PUBLIC_KEY = `G${"A".repeat(55)}`;
    const PUBLIC_KEY_2 = `G${"Z".repeat(55)}`;
    const SECRET_SEED = `S${"A".repeat(55)}`;

    describe("unit: scrubStrKeys helper", () => {
      it("replaces a publicKey with G***", () => {
        expect(scrubStrKeys(`Account ${PUBLIC_KEY} not found`)).toBe(
          "Account G*** not found",
        );
      });

      it("replaces a secret seed with S*** (defense-in-depth)", () => {
        // Secret seeds should NEVER reach this code path - they're meant
        // to stay encrypted in the keychain. This is a last-line defense.
        expect(scrubStrKeys(`Decryption failed for ${SECRET_SEED}`)).toBe(
          "Decryption failed for S***",
        );
      });

      it("replaces multiple StrKeys in the same string", () => {
        expect(scrubStrKeys(`From ${PUBLIC_KEY} to ${PUBLIC_KEY_2}`)).toBe(
          "From G*** to G***",
        );
      });

      it("returns undefined for undefined input", () => {
        expect(scrubStrKeys(undefined)).toBeUndefined();
      });

      it("returns the string unchanged when no StrKey is present", () => {
        const msg = "Failed to fetch token details";
        expect(scrubStrKeys(msg)).toBe(msg);
      });

      it("does NOT match wrong prefix (e.g. A-prefixed 56-char string)", () => {
        const fake = `A${PUBLIC_KEY.slice(1)}`; // 56 chars, wrong prefix
        expect(scrubStrKeys(`Foo ${fake} bar`)).toBe(`Foo ${fake} bar`);
      });

      it("does NOT match wrong length (54 or 57 chars with G prefix)", () => {
        const tooShort = PUBLIC_KEY.slice(0, -1); // 55 chars
        const tooLong = `${PUBLIC_KEY}A`; // 57 chars
        expect(scrubStrKeys(`${tooShort} ${tooLong}`)).toBe(
          `${tooShort} ${tooLong}`,
        );
      });

      it("does NOT match a 56-char run embedded inside a longer alphanumeric string", () => {
        // Word-boundary anchors prevent partial matches inside larger
        // alphanumeric runs (e.g. URL slugs without separators).
        const embedded = `XXX${PUBLIC_KEY}XXX`;
        expect(scrubStrKeys(embedded)).toBe(embedded);
      });

      it("matches a StrKey embedded in URL-shaped paths (separators are non-word chars)", () => {
        expect(
          scrubStrKeys(
            `https://horizon.stellar.org/accounts/${PUBLIC_KEY}/operations`,
          ),
        ).toBe("https://horizon.stellar.org/accounts/G***/operations");
      });
    });

    describe("integration: beforeSend applies scrub to event surfaces", () => {
      it("scrubs event.exception.values[].value", () => {
        const result = runBeforeSendWith({
          type: undefined,
          exception: {
            values: [
              {
                type: "Error",
                value: `Failed for ${PUBLIC_KEY}`,
              },
            ],
          },
        }) as ErrorEvent;

        expect(result?.exception?.values?.[0].value).toBe("Failed for G***");
      });

      it("scrubs event.message (captureMessage path)", () => {
        const result = runBeforeSendWith({
          type: undefined,
          message: `Operation failed for account ${PUBLIC_KEY}`,
        }) as ErrorEvent;

        expect(result?.message).toBe("Operation failed for account G***");
      });

      it("scrubs event.extra.message (the logger.error message-into-extras path)", () => {
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: {
            message: `User-friendly description for ${PUBLIC_KEY}`,
          },
        }) as ErrorEvent;

        expect(result?.extra?.message).toBe(
          "User-friendly description for G***",
        );
      });

      it("does NOT mutate event.contexts (opt-in users keep their unredacted publicKey for triage)", () => {
        // The scrub targets raw message surfaces. The deliberate
        // appContext.publicKey set by buildSentryContext is on a
        // different field path and should be untouched.
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          contexts: {
            appContext: { publicKey: PUBLIC_KEY },
          },
        }) as ErrorEvent;

        expect(result?.contexts?.appContext?.publicKey).toBe(PUBLIC_KEY);
      });
    });

    describe("deep scrub: event.extra.args (recursive walk)", () => {
      // Object-key redaction (PII_FIELDS_LOWER) catches known field
      // names. The deep scrub catches StrKeys embedded in any string
      // value, regardless of field name - the leak surface for
      // backend payload shapes with `owner` / `from` / `recipient`.

      it("scrubs StrKey nested inside event.extra.args (logger.error structured args)", () => {
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: {
            args: [{ owner: PUBLIC_KEY, otherField: "ok" }],
          },
        }) as ErrorEvent;

        const args = (
          result?.extra?.args as Array<{
            owner?: string;
            otherField?: string;
          }>
        )[0];
        expect(args.owner).toBe("G***");
        expect(args.otherField).toBe("ok");
      });

      it("scrubs StrKeys at depth (nested objects and arrays)", () => {
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: {
            payload: {
              data: {
                collections: [
                  { collectibles: [{ owner: PUBLIC_KEY, name: "ok" }] },
                ],
              },
            },
          },
        }) as ErrorEvent;

        const { owner } = (
          result?.extra?.payload as {
            data: {
              collections: Array<{ collectibles: Array<{ owner: string }> }>;
            };
          }
        ).data.collections[0].collectibles[0];
        expect(owner).toBe("G***");
      });

      it("preserves non-string types (numbers, booleans, null) in extras", () => {
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: {
            count: 42,
            enabled: true,
            ratio: null,
            note: `account ${PUBLIC_KEY}`,
          },
        }) as ErrorEvent;

        expect(result?.extra?.count).toBe(42);
        expect(result?.extra?.enabled).toBe(true);
        expect(result?.extra?.ratio).toBeNull();
        expect(result?.extra?.note).toBe("account G***");
      });

      it("scrubs StrKeys inside breadcrumb.data (logger.warn args path)", () => {
        // logger.warn ships args as breadcrumb data. A backend
        // payload shape with `owner` would slip past sanitizeLogData's
        // field-name redaction.
        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          breadcrumbs: [
            {
              category: "fetchCollectibles",
              message: "Backend error for collection",
              level: "warning",
              data: {
                args: [
                  {
                    collection: { owner: PUBLIC_KEY, name: "Soroban Frogs" },
                  },
                ],
              },
            },
          ],
        }) as ErrorEvent;

        const { owner } = (
          result?.breadcrumbs?.[0].data?.args as Array<{
            collection: { owner: string };
          }>
        )[0].collection;
        expect(owner).toBe("G***");
      });

      it("replaces cyclic substructures with a sentinel instead of returning the original reference", () => {
        // At the depth cap the walker must return a sentinel string,
        // not the original subtree, otherwise a cyclic ref escapes
        // into event.extra (defense-in-depth even if Sentry's
        // serializer would also handle cycles). The positive
        // guarantee here is that the post-scrub event payload is
        // JSON-serializable - no live cycles survived.
        const cyclic: Record<string, unknown> = { a: PUBLIC_KEY };
        cyclic.self = cyclic;

        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: { cyclic },
        }) as ErrorEvent;

        expect(() => JSON.stringify(result?.extra)).not.toThrow();
      });

      it("replaces values past the depth cap with a sentinel string (so deep StrKeys cannot leak)", () => {
        // The walker enters event.extra at depth 0; each property
        // descent increments depth. With MAX_DEEP_SCRUB_DEPTH = 8,
        // a value reached at depth 8 is replaced with the sentinel
        // (not the original subtree).
        const deep = {
          a: { b: { c: { d: { e: { f: { g: { h: { i: PUBLIC_KEY } } } } } } } },
        };

        const result = runBeforeSendWith({
          type: undefined,
          exception: { values: [{ type: "Error", value: "boom" }] },
          extra: { deep },
        }) as ErrorEvent;

        // The strongest leak guarantee: the original publicKey
        // string must not appear ANYWHERE in the serialized payload.
        // The depth cap clips the subtree before it can be walked
        // for StrKey replacement.
        expect(JSON.stringify(result?.extra)).not.toContain(PUBLIC_KEY);
        expect(JSON.stringify(result?.extra)).toContain("[MAX_DEPTH_EXCEEDED]");
      });
    });
  });
});
