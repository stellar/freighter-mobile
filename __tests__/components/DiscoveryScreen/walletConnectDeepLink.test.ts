import { forwardWalletConnectDeepLink } from "components/screens/DiscoveryScreen/walletConnectDeepLink";

const NATIVE_REDIRECT = "freighterwallet://wc-redirect";
const PAIRING_URL = `${NATIVE_REDIRECT}/wc?uri=${encodeURIComponent(
  "wc:topic@2?relay-protocol=irn&symKey=secret",
)}`;

describe("forwardWalletConnectDeepLink", () => {
  it("forwards the registered deep link to React Native Linking", () => {
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
  });

  it("ignores lookalike URLs that only contain the redirect as data", () => {
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
