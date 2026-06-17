import { renderHook, act } from "@testing-library/react-hooks";
import { AUTO_LOCK_TIMER } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAuthCheck from "hooks/useAuthCheck";
import { AppState } from "react-native";
import {
  getAutoLockTimer,
  getDevAutoLockTimerMs,
  hasPersistedSession,
  recordBackgroundedAt,
  recordDevInteraction,
} from "services/autoLock";

jest.mock("services/autoLock", () => ({
  getAutoLockTimer: jest.fn(),
  getDevAutoLockTimerMs: jest.fn().mockResolvedValue(null),
  hasPersistedSession: jest.fn().mockResolvedValue(false),
  recordBackgroundedAt: jest.fn().mockResolvedValue(undefined),
  recordDevInteraction: jest.fn(),
}));

// components/App pulls in the full app tree (RootNavigator → native-only
// modules); stub it to just the navigationRef the hook subscribes to.
const mockNavUnsubscribe = jest.fn();
const mockNavAddListener = jest.fn<() => void, [string, () => void]>(
  () => mockNavUnsubscribe,
);
jest.mock("components/App", () => ({
  navigationRef: {
    addListener: (event: string, callback: () => void) =>
      mockNavAddListener(event, callback),
  },
}));

const flushMicrotasks = async () => {
  // Several rounds so the async background handler (session check → record →
  // timer read → soft lock) fully settles.
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe("useAuthCheck", () => {
  const mockGetAuthStatus = jest
    .fn()
    .mockResolvedValue(AUTH_STATUS.AUTHENTICATED);
  const mockSoftLock = jest.fn().mockResolvedValue(undefined);
  const previousAppState = AppState.currentState;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // The RN jest mock leaves currentState as a jest.fn; the hook tracks it
    // as a string
    (AppState as { currentState: string }).currentState = "active";

    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS,
    );
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(null);
    (hasPersistedSession as jest.Mock).mockResolvedValue(false);

    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.AUTHENTICATED,
      isSoftLocked: false,
      getAuthStatus: mockGetAuthStatus,
      softLock: mockSoftLock,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    (AppState as { currentState: typeof previousAppState }).currentState =
      previousAppState;
  });

  const getAppStateHandlers = () =>
    (AppState.addEventListener as jest.Mock).mock.calls
      .filter(([eventName]) => eventName === "change")
      .map(([, handler]) => handler as (state: string) => void);

  const renderAuthCheck = () => {
    const rendered = renderHook(() => useAuthCheck());
    const handlers = getAppStateHandlers();
    return { ...rendered, handlers };
  };

  it("records the backgrounded-at timestamp when the app goes to the background while authenticated", async () => {
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does NOT record a timestamp on inactive transitions", async () => {
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("inactive"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).not.toHaveBeenCalled();
    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT record a timestamp when not authenticated", async () => {
    useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).not.toHaveBeenCalled();
    unmount();
  });

  it("records the timestamp when a session is persisted but the status has not hydrated yet", async () => {
    // Cold launch into an existing session, backgrounded before getAuthStatus
    // runs: zustand still holds the initial NOT_AUTHENTICATED status.
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
    });
    (hasPersistedSession as jest.Mock).mockResolvedValue(true);
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does NOT record when not authenticated and no session is persisted", async () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.NOT_AUTHENTICATED,
    });
    (hasPersistedSession as jest.Mock).mockResolvedValue(false);
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).not.toHaveBeenCalled();
    unmount();
  });

  it("soft-locks immediately on backgrounding when the timer is IMMEDIATELY", async () => {
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.IMMEDIATELY,
    );
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).toHaveBeenCalledTimes(1);
    expect(mockSoftLock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does NOT soft-lock on backgrounding for timed options", async () => {
    (getAutoLockTimer as jest.Mock).mockResolvedValue(AUTO_LOCK_TIMER.ONE_HOUR);
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).toHaveBeenCalledTimes(1);
    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  // TODO/FIXME: dev-only override exclusivity — remove with the dev feature
  it("does NOT instant-lock for IMMEDIATELY when a dev timer override is set", async () => {
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.IMMEDIATELY,
    );
    // A custom dev timer (20s) is active — it must win over IMMEDIATELY so the
    // timed countdown governs instead of an instant lock
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(20000);
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      handlers.forEach((handler) => handler("background"));
      await flushMicrotasks();
    });

    expect(recordBackgroundedAt).toHaveBeenCalledTimes(1);
    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("delegates lock transitions to the store getAuthStatus funnel on foreground return", async () => {
    const { handlers, unmount } = renderAuthCheck();

    await act(async () => {
      // background → active triggers the delayed auth check; advance past
      // MIN_CHECK_INTERVAL and the active check interval so checkAuth runs
      handlers.forEach((handler) => handler("background"));
      handlers.forEach((handler) => handler("active"));
      jest.advanceTimersByTime(6000);
      await flushMicrotasks();
    });

    expect(mockGetAuthStatus).toHaveBeenCalled();
    unmount();
  });

  it("idle-locks while foregrounded after the timer with no interaction", async () => {
    // Short timer (1s) via the dev override so idle elapses within the test
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(1000);
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(400); // let the periodic check interval set up
      await flushMicrotasks();
    });
    await act(async () => {
      // No interaction; advance well past the 1s idle timeout so a periodic
      // check observes the idle and soft-locks
      jest.advanceTimersByTime(6000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).toHaveBeenCalled();
    unmount();
  });

  it("does NOT idle-lock before the timer elapses", async () => {
    // Long timer (100s) so the elapsed idle stays under it
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(100000);
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(400);
      await flushMicrotasks();
    });
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("resets the idle clock when the wallet becomes unlocked", async () => {
    // The lock screen / overlay sits outside this provider's PanResponder, so
    // its touches don't update the idle clock — unlock must reset it (proxied
    // here by recordDevInteraction, which the reset effect calls alongside
    // resetting lastInteractionRef) or a fresh session would re-lock at once.
    const { unmount } = renderAuthCheck();

    await act(async () => {
      useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
      await flushMicrotasks();
    });
    (recordDevInteraction as jest.Mock).mockClear();

    await act(async () => {
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
      });
      await flushMicrotasks();
    });

    expect(recordDevInteraction).toHaveBeenCalled();
    unmount();
  });

  it("subscribes to navigation changes as an interaction signal", () => {
    const { unmount } = renderAuthCheck();

    expect(mockNavAddListener).toHaveBeenCalledWith(
      "state",
      expect.any(Function),
    );
    unmount();
  });

  it("resets the idle clock on a navigation change so a multi-screen flow is not idle-locked", async () => {
    // Short timer (1s); the user navigates just before it would elapse
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(1000);
    const { unmount } = renderAuthCheck();

    // The hook registers a "state" listener; grab the callback the same way
    // the navigation container would invoke it on a route change.
    const navListener = mockNavAddListener.mock.calls.find(
      ([eventName]) => eventName === "state",
    )?.[1] as () => void;

    await act(async () => {
      jest.advanceTimersByTime(800);
      // A navigation occurs before the 1s idle elapses → resets the clock
      navListener();
      await flushMicrotasks();
    });
    await act(async () => {
      // Another 800ms (1.6s total, but only 800ms since the nav) — still under
      // the timer, so no idle-lock
      jest.advanceTimersByTime(800);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT idle-lock for the NONE / IMMEDIATELY presets", async () => {
    // No dev override; NONE has a null duration → never idle-locks
    (getDevAutoLockTimerMs as jest.Mock).mockResolvedValue(null);
    (getAutoLockTimer as jest.Mock).mockResolvedValue(AUTO_LOCK_TIMER.NONE);
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(400);
      await flushMicrotasks();
    });
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });
});
