import { act, renderHook } from "@testing-library/react-native";
import { NETWORKS } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useDappApprovalStore } from "ducks/dappApproval";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { useWebviewBridge } from "hooks/useWebviewBridge";
import type { WebView } from "react-native-webview";

jest.mock("react-native-quick-crypto", () => ({
  randomBytes: (size: number) => Buffer.alloc(size, 7),
}));

const ORIGIN = "https://example.org";
const TAB_ID = "tab-1";
const PUBLIC_KEY = "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";
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
  return { ...hook, injectJavaScript, activationToken };
};

describe("useWebviewBridge", () => {
  beforeEach(() => {
    useDappApprovalStore.setState({ job: null, walletConnectBusy: false });
    useRemoteConfigStore.setState({ webview_provider_enabled: false });
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
});
