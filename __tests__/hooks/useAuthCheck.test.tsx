import { renderHook, act } from "@testing-library/react-hooks";
import { AUTO_LOCK_TIMER } from "config/constants";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAuthCheck from "hooks/useAuthCheck";
import { AppState } from "react-native";
import { getAutoLockTimer, recordBackgroundedAt } from "services/autoLock";

jest.mock("services/autoLock", () => ({
  getAutoLockTimer: jest.fn(),
  recordBackgroundedAt: jest.fn().mockResolvedValue(undefined),
}));

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
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
});
