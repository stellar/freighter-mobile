import { act, renderHook } from "@testing-library/react-native";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { WebviewBridgeMethod } from "config/dappRequest";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useDappApprovalStore } from "ducks/dappApproval";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWebviewBridge } from "hooks/useWebviewBridge";
import type { WebView } from "react-native-webview";
import { prepareSep10Auth } from "services/webview/sep10";

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size, 7),
}));
jest.mock("services/webview/sep10", () => ({ prepareSep10Auth: jest.fn() }));

const ORIGIN = "https://example.org";
const TAB_ID = "tab-1";
const PUBLIC_KEY = "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
const AUTH = {
  challengeXdr: "challenge",
  signedXdr: "signed",
  networkPassphrase: mapNetworkToNetworkDetails(NETWORKS.TESTNET)
    .networkPassphrase,
  homeDomain: "example.org",
  webAuthEndpoint: `${ORIGIN}/auth`,
};

const setup = () => {
  const injectJavaScript = jest.fn();
  const refs = {
    current: { [TAB_ID]: { injectJavaScript } as unknown as WebView },
  };
  const hook = renderHook(() => useWebviewBridge(refs));
  const activationToken = () => {
    const activation = injectJavaScript.mock.calls
      .map(([script]: [string]) =>
        /__freighterActivate\("([0-9a-f]+)"\)/.exec(script),
      )
      .find(Boolean);
    return activation?.[1] ?? "";
  };
  const connect = (id: string) =>
    hook.result.current.receive(
      TAB_ID,
      JSON.stringify({
        protocol: "freighter-webview",
        version: 1,
        id,
        documentToken: activationToken(),
        method: WebviewBridgeMethod.CONNECT,
        params: {},
      }),
      ORIGIN,
    );
  return { ...hook, injectJavaScript, activationToken, connect };
};

const approvePendingSite = async () => {
  await act(async () => {});
  const { job } = useDappApprovalStore.getState();
  expect(job?.kind).toBe("site");
  await act(async () => {
    await job!.request.respond({
      id: job!.request.id,
      jsonrpc: "2.0",
      result: true,
    });
  });
};

describe("useWebviewBridge", () => {
  beforeEach(() => {
    jest.mocked(prepareSep10Auth).mockReset().mockResolvedValue(AUTH);
    useDappApprovalStore.setState({ job: null, walletConnectBusy: false });
    useRemoteConfigStore.setState({
      webview_provider_enabled: false,
      webview_auto_signin_enabled: false,
    });
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.AUTHENTICATED,
      isSoftLocked: false,
      network: NETWORKS.TESTNET,
      account: { publicKey: PUBLIC_KEY } as never,
    });
    useBrowserTabsStore.setState({
      tabs: [
        {
          id: TAB_ID,
          url: `${ORIGIN}/app`,
          title: "",
          canGoBack: false,
          canGoForward: false,
          lastAccessed: 0,
        },
      ],
      activeTabId: TAB_ID,
      showTabOverview: false,
    });
  });

  it("injects nothing while webview_provider_enabled is off", () => {
    const h = setup();
    expect(h.result.current.enabled).toBe(false);
    h.result.current.start(TAB_ID, `${ORIGIN}/app`);
    h.result.current.loaded(TAB_ID, `${ORIGIN}/app`);
    expect(h.injectJavaScript).not.toHaveBeenCalled();
  });

  it("activates already-mounted tabs once the flag turns on", () => {
    const h = setup();
    h.result.current.start(TAB_ID, `${ORIGIN}/app`);
    act(() => {
      useRemoteConfigStore.setState({ webview_provider_enabled: true });
    });
    expect(h.result.current.enabled).toBe(true);
    expect(h.activationToken()).toBe("07".repeat(24));
    expect(h.injectJavaScript.mock.calls[0][0]).toContain(
      `location.origin === ${JSON.stringify(ORIGIN)}`,
    );
  });

  it("connects without a SEP-10 auth while webview_auto_signin_enabled is off", async () => {
    useRemoteConfigStore.setState({ webview_provider_enabled: true });
    const h = setup();
    h.result.current.start(TAB_ID, `${ORIGIN}/app`);
    h.result.current.loaded(TAB_ID, `${ORIGIN}/app`);
    const pending = h.connect("1");
    await approvePendingSite();
    await pending;
    expect(prepareSep10Auth).not.toHaveBeenCalled();
    const delivered = h.injectJavaScript.mock.calls.at(-1)[0] as string;
    expect(delivered).toContain(PUBLIC_KEY);
    expect(delivered).not.toMatch(/"auth":/);
    expect(useDappApprovalStore.getState().job).toBeNull();
  });

  it("countersigns and returns the SEP-10 auth on connect when auto sign-in is on", async () => {
    useRemoteConfigStore.setState({
      webview_provider_enabled: true,
      webview_auto_signin_enabled: true,
    });
    const h = setup();
    h.result.current.start(TAB_ID, `${ORIGIN}/app`);
    h.result.current.loaded(TAB_ID, `${ORIGIN}/app`);
    const pending = h.connect("1");
    await approvePendingSite();
    await pending;
    expect(prepareSep10Auth).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ORIGIN,
        account: expect.objectContaining({
          address: PUBLIC_KEY,
          chainId: "stellar:testnet",
        }),
      }),
    );
    const delivered = h.injectJavaScript.mock.calls.at(-1)[0] as string;
    expect(delivered).toMatch(/"auth":/);
    expect(delivered).toContain(AUTH.signedXdr);
  });
});
