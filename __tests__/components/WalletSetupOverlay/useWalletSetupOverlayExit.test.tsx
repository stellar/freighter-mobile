import { act, renderHook } from "@testing-library/react-native";
import {
  selectAreBalancesSettled,
  useWalletSetupOverlayExit,
} from "components/WalletSetupOverlay/useWalletSetupOverlayExit";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import {
  useWalletSetupOverlayStore,
  walletSetupClock,
} from "ducks/walletSetupOverlay";

const PUBLIC_KEY = "GBNEWWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const phase = () => useWalletSetupOverlayStore.getState().phase;

const setBalances = (balances: {
  fetchedPublicKey: string | null;
  isLoading: boolean;
  error: string | null;
}) => act(() => useBalancesStore.setState(balances));

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe("useWalletSetupOverlayExit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthenticationStore.setState({
      account: { publicKey: PUBLIC_KEY } as never,
      authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
    });
    useBalancesStore.setState({
      fetchedPublicKey: null,
      isLoading: false,
      error: null,
    });
    useWalletSetupOverlayStore.setState({
      phase: "ready",
      flow: "create",
      readyAt: walletSetupClock(),
    });
  });
  afterEach(() => jest.useRealTimers());

  it("waits a second even when the balances are already in", () => {
    useBalancesStore.setState({ fetchedPublicKey: PUBLIC_KEY });
    renderHook(() => useWalletSetupOverlayExit());

    advance(999);
    expect(phase()).toBe("ready");

    advance(1);
    expect(phase()).toBe("leaving");
  });

  it("leaves as soon as the balances come in after that second", () => {
    renderHook(() => useWalletSetupOverlayExit());
    setBalances({ fetchedPublicKey: null, isLoading: true, error: null });

    advance(1800);
    expect(phase()).toBe("ready");

    setBalances({
      fetchedPublicKey: PUBLIC_KEY,
      isLoading: false,
      error: null,
    });
    advance(0);
    expect(phase()).toBe("leaving");
  });

  it("leaves after three seconds when the balances never come in", () => {
    renderHook(() => useWalletSetupOverlayExit());
    setBalances({ fetchedPublicKey: null, isLoading: true, error: null });

    advance(2999);
    expect(phase()).toBe("ready");

    advance(1);
    expect(phase()).toBe("leaving");
  });

  it("leaves once the balances fail to load, after that second", () => {
    renderHook(() => useWalletSetupOverlayExit());

    advance(1200);
    setBalances({ fetchedPublicKey: null, isLoading: false, error: "offline" });
    advance(0);

    expect(phase()).toBe("leaving");
  });

  // RootNavigator can swap its tree out and back, remounting the screen.
  it("counts from when setup finished, not from when it mounted", () => {
    useWalletSetupOverlayStore.setState({
      readyAt: walletSetupClock() - 2500,
    });
    renderHook(() => useWalletSetupOverlayExit());

    advance(499);
    expect(phase()).toBe("ready");

    advance(1);
    expect(phase()).toBe("leaving");
  });

  // A network time update can set the device's clock back. That mustn't
  // stretch the wait, or the screen would stay up, back blocked, for as long
  // as the clock was set back.
  it("leaves on time when the device's clock is set back", () => {
    useWalletSetupOverlayStore.setState({ phase: "settingUp", readyAt: null });
    act(() => useWalletSetupOverlayStore.getState().succeed());
    renderHook(() => useWalletSetupOverlayExit());
    setBalances({ fetchedPublicKey: null, isLoading: true, error: null });
    advance(500);

    act(() => jest.setSystemTime(Date.now() - 60 * 60 * 1000));
    setBalances({
      fetchedPublicKey: PUBLIC_KEY,
      isLoading: false,
      error: null,
    });

    advance(500);
    expect(phase()).toBe("leaving");
  });

  it("does nothing until setup has finished", () => {
    useWalletSetupOverlayStore.setState({ phase: "settingUp", readyAt: null });
    renderHook(() => useWalletSetupOverlayExit());

    advance(5000);
    expect(phase()).toBe("settingUp");
  });

  // Once the app is authenticated the wallet is stored and Home is mounted
  // beneath. What's left of setup (loading the account, or an import's
  // search for other accounts) mustn't keep the screen up if it stalls.
  it("turns ready when setup stalls after the app is authenticated", () => {
    useWalletSetupOverlayStore.setState({ phase: "settingUp", readyAt: null });
    useAuthenticationStore.setState({ authStatus: AUTH_STATUS.AUTHENTICATED });
    renderHook(() => useWalletSetupOverlayExit());

    advance(4999);
    expect(phase()).toBe("settingUp");

    advance(1);
    expect(phase()).toBe("ready");
  });

  // The app's periodic auth check can see an imported wallet on disk before
  // importWallet has finished searching for its other accounts. The screen
  // keeps saying "Importing your wallet..." while the auth store says it's
  // still loading, up to 20s, rather than calling it ready early.
  it("waits longer while an import is still running after the app is authenticated", () => {
    useWalletSetupOverlayStore.setState({ phase: "settingUp", readyAt: null });
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.AUTHENTICATED,
      isLoading: true,
    });
    renderHook(() => useWalletSetupOverlayExit());

    advance(19999);
    expect(phase()).toBe("settingUp");

    advance(1);
    expect(phase()).toBe("ready");
  });

  it("waits on setup for as long as the app isn't authenticated", () => {
    useWalletSetupOverlayStore.setState({ phase: "settingUp", readyAt: null });
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
    });
    renderHook(() => useWalletSetupOverlayExit());

    advance(20000);
    expect(phase()).toBe("settingUp");
  });
});

describe("selectAreBalancesSettled", () => {
  const loaded = {
    fetchedPublicKey: PUBLIC_KEY,
    isLoading: false,
    error: null,
  };

  it.each([
    ["no active account yet", undefined, loaded, false],
    [
      "nothing fetched yet",
      PUBLIC_KEY,
      { fetchedPublicKey: null, isLoading: false, error: null },
      false,
    ],
    [
      "still loading the account",
      PUBLIC_KEY,
      { fetchedPublicKey: PUBLIC_KEY, isLoading: true, error: null },
      false,
    ],
    ["loaded for the account", PUBLIC_KEY, loaded, true],
    [
      "failed to load",
      PUBLIC_KEY,
      { fetchedPublicKey: null, isLoading: false, error: "offline" },
      true,
    ],
    [
      "loaded for another account",
      PUBLIC_KEY,
      { fetchedPublicKey: "GOTHER", isLoading: false, error: null },
      false,
    ],
  ])("%s", (_, activePublicKey, balances, expected) => {
    expect(selectAreBalancesSettled(activePublicKey, balances)).toBe(expected);
  });
});
