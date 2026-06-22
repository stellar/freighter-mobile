import { renderHook, act } from "@testing-library/react-hooks";
import { AUTO_LOCK_TIMER } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAuthCheck from "hooks/useAuthCheck";
import { AppState } from "react-native";
import {
  getAutoLockTimer,
  hasPersistedSession,
  recordBackgroundedAt,
} from "services/autoLock";

jest.mock("services/autoLock", () => ({
  getAutoLockTimer: jest.fn(),
  hasPersistedSession: jest.fn().mockResolvedValue(false),
  recordBackgroundedAt: jest.fn().mockResolvedValue(undefined),
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

// Real durations from config/constants: ONE_MINUTE is the shortest timed
// preset, so idle tests step across the 60s boundary.
const ONE_MINUTE_MS = 60000;

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
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.ONE_MINUTE,
    );
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(1000); // let the periodic check interval set up
      await flushMicrotasks();
    });
    await act(async () => {
      // No interaction; advance past the 1-minute idle timeout so a periodic
      // check observes the idle and soft-locks
      jest.advanceTimersByTime(ONE_MINUTE_MS + 5000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).toHaveBeenCalled();
    unmount();
  });

  it("does NOT idle-lock before the timer elapses", async () => {
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.ONE_MINUTE,
    );
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flushMicrotasks();
    });
    await act(async () => {
      // Half the timeout — still under a minute, so no idle-lock
      jest.advanceTimersByTime(ONE_MINUTE_MS / 2);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("resets the idle clock on unlock so it does not immediately re-lock", async () => {
    // The lock screen / overlay sits outside this provider's PanResponder, so
    // its touches don't update the idle clock — unlock must reset it or a
    // fresh session would re-lock at once.
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.ONE_MINUTE,
    );
    const { unmount } = renderAuthCheck();

    // Idle most of the way to the timeout while authenticated
    await act(async () => {
      jest.advanceTimersByTime(ONE_MINUTE_MS - 10000);
      await flushMicrotasks();
    });

    // Lock, then unlock — the unlock-reset effect must restart the idle clock
    await act(async () => {
      useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
      await flushMicrotasks();
    });
    await act(async () => {
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
      });
      await flushMicrotasks();
    });
    mockSoftLock.mockClear();

    // Another 50s: ~100s since mount but only ~50s since the unlock reset
    // (under the minute) → must NOT lock
    await act(async () => {
      jest.advanceTimersByTime(ONE_MINUTE_MS - 10000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
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
    (getAutoLockTimer as jest.Mock).mockResolvedValue(
      AUTO_LOCK_TIMER.ONE_MINUTE,
    );
    const { unmount } = renderAuthCheck();

    // The hook registers a "state" listener; grab the callback the same way
    // the navigation container would invoke it on a route change.
    const navListener = mockNavAddListener.mock.calls.find(
      ([eventName]) => eventName === "state",
    )?.[1] as () => void;

    await act(async () => {
      // Idle most of the way to the timeout, then navigate just before it
      jest.advanceTimersByTime(ONE_MINUTE_MS - 10000);
      navListener();
      await flushMicrotasks();
    });
    await act(async () => {
      // Another ~50s: well over a minute since mount, but only ~50s since the
      // navigation reset → no idle-lock
      jest.advanceTimersByTime(ONE_MINUTE_MS - 10000);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT idle-lock for the NONE preset", async () => {
    (getAutoLockTimer as jest.Mock).mockResolvedValue(AUTO_LOCK_TIMER.NONE);
    const { unmount } = renderAuthCheck();

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await flushMicrotasks();
    });
    await act(async () => {
      jest.advanceTimersByTime(ONE_MINUTE_MS * 2);
      await flushMicrotasks();
    });

    expect(mockSoftLock).not.toHaveBeenCalled();
    unmount();
  });
});
