/* eslint-disable @fnando/consistent-import/consistent-import */
import type { ErrorEvent } from "@sentry/core";
import * as Sentry from "@sentry/react-native";
import { initializeSentry } from "config/sentryConfig";

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
    it("downgrades 'Invalid mnemonic' to a breadcrumb", () => {
      expect(runBeforeSend("Error: Invalid mnemonic (see bip39)")).toBeNull();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "user-input-validation",
          level: "info",
        }),
      );
    });

    it("downgrades 'Invalid password' to a breadcrumb", () => {
      expect(
        runBeforeSend("Error: Invalid password. Please try again."),
      ).toBeNull();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "user-input-validation",
          level: "info",
        }),
      );
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
          level: "info",
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
});
