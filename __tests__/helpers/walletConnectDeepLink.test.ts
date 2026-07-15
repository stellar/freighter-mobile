import {
  forwardWalletConnectDeepLink,
  parseWalletConnectDeepLink,
} from "helpers/walletConnectDeepLink";

const NATIVE_REDIRECT = "freighterwallet://wc-redirect";
const PAIRING_URI = `wc:${"a".repeat(
  64,
)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;
const PAIRING_URL = `${NATIVE_REDIRECT}/wc?uri=${encodeURIComponent(
  PAIRING_URI,
)}`;

describe("WalletConnect deep links", () => {
  it("forwards a validated pairing link to React Native Linking", () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    const onError = jest.fn();

    expect(
      forwardWalletConnectDeepLink({
        url: PAIRING_URL,
        nativeRedirect: NATIVE_REDIRECT,
        openUrl,
        onError,
      }),
    ).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(PAIRING_URL);
    expect(onError).not.toHaveBeenCalled();
    expect(parseWalletConnectDeepLink(PAIRING_URL, NATIVE_REDIRECT)).toEqual({
      isAppScheme: true,
      pairingUri: PAIRING_URI,
    });
  });

  it("supports a scheme-root redirect without broadening the matched route", () => {
    const url = `freighterdev://wc?uri=${encodeURIComponent(PAIRING_URI)}`;
    expect(parseWalletConnectDeepLink(url, "freighterdev://")).toEqual({
      isAppScheme: true,
      pairingUri: PAIRING_URI,
    });
    expect(
      parseWalletConnectDeepLink(
        `freighterdev://settings?uri=${encodeURIComponent(PAIRING_URI)}`,
        "freighterdev://",
      ),
    ).toEqual({ isAppScheme: true, pairingUri: null });
  });

  it("ignores lookalike web URLs that only contain the redirect as data", () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);

    expect(
      forwardWalletConnectDeepLink({
        url: `https://example.com/?next=${encodeURIComponent(PAIRING_URL)}`,
        nativeRedirect: NATIVE_REDIRECT,
        openUrl,
        onError: jest.fn(),
      }),
    ).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it.each([
    `${NATIVE_REDIRECT}/settings?uri=${encodeURIComponent(PAIRING_URI)}`,
    `${NATIVE_REDIRECT}/wc?uri=%E0%A4%A`,
    `${NATIVE_REDIRECT}/wc?uri=${encodeURIComponent("wc:not-a-v2-pairing")}`,
  ])(
    "consumes an invalid app-scheme navigation without forwarding %s",
    (url) => {
      const openUrl = jest.fn().mockResolvedValue(undefined);
      expect(
        forwardWalletConnectDeepLink({
          url,
          nativeRedirect: NATIVE_REDIRECT,
          openUrl,
          onError: jest.fn(),
        }),
      ).toBe(true);
      expect(openUrl).not.toHaveBeenCalled();
    },
  );

  it("reports a native handoff failure without allowing WebView navigation", async () => {
    const error = new Error("linking unavailable");
    const onError = jest.fn();

    expect(
      forwardWalletConnectDeepLink({
        url: PAIRING_URL,
        nativeRedirect: NATIVE_REDIRECT,
        openUrl: jest.fn().mockRejectedValue(error),
        onError,
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
