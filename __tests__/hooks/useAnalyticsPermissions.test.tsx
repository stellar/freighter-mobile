import { renderHook, act } from "@testing-library/react-hooks";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useAnalyticsPermissions } from "hooks/useAnalyticsPermissions";
import { AppState, AppStateStatus } from "react-native";
import {
  reconcileAnalyticsUserId,
  resetAnalyticsUserIdReconciliation,
} from "services/analytics/reconcileUserId";

// The AUTHENTICATED transition reconciles the analytics/Sentry identity via
// reconcileAnalyticsUserId (which internally identifies + pushes to Sentry).
jest.mock("services/analytics/reconcileUserId", () => ({
  reconcileAnalyticsUserId: jest.fn(),
  resetAnalyticsUserIdReconciliation: jest.fn(),
}));

const mockReconcile = reconcileAnalyticsUserId as jest.Mock;
const mockReset = resetAnalyticsUserIdReconciliation as jest.Mock;

const flushMicrotasks = async () => {
  // Let the async mount effect (permission check → init → identify) settle.
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe("useAnalyticsPermissions — auth-transition identity reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Start locked: this is the cold-start state in which the mount effect runs
    // before the user unlocks.
    useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
  });

  it("re-identifies the user when auth transitions to AUTHENTICATED (migration path)", async () => {
    const { unmount } = renderHook(() => useAnalyticsPermissions());

    // Let the mount effect run while still locked, then ignore its identify
    // call — we are asserting on the unlock transition specifically.
    await act(async () => {
      await flushMicrotasks();
    });
    mockReconcile.mockClear();

    // Unlock: the seed-derived auth id is now derivable, so identity must be
    // reconciled to migrate an existing random id → the stable auth id.
    await act(async () => {
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
      });
      await flushMicrotasks();
    });

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("resets the guard on lock and adopts the cached id without settling", async () => {
    // Start authenticated so the first transition under test is → LOCKED.
    useAuthenticationStore.setState({ authStatus: AUTH_STATUS.AUTHENTICATED });
    const { unmount } = renderHook(() => useAnalyticsPermissions());

    await act(async () => {
      await flushMicrotasks();
    });
    mockReconcile.mockClear();
    mockReset.mockClear();

    await act(async () => {
      useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
      await flushMicrotasks();
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith({ settle: false });
    unmount();
  });

  it("reconciles on a HASH_KEY_EXPIRED → AUTHENTICATED re-unlock", async () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
    });
    const { unmount } = renderHook(() => useAnalyticsPermissions());

    await act(async () => {
      await flushMicrotasks();
    });
    mockReconcile.mockClear();

    await act(async () => {
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
      });
      await flushMicrotasks();
    });

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("asks again on each foreground while authenticated", async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    const addListener = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        listeners.push(listener as (state: AppStateStatus) => void);
        return { remove: jest.fn() };
      });
    useAuthenticationStore.setState({ authStatus: AUTH_STATUS.AUTHENTICATED });
    const { unmount } = renderHook(() => useAnalyticsPermissions());

    await act(async () => {
      await flushMicrotasks();
    });
    const [onChange] = listeners.slice(-1);
    // The first change after mount counts as the initial launch.
    await act(async () => {
      onChange("background");
      await flushMicrotasks();
    });
    mockReconcile.mockClear();

    await act(async () => {
      onChange("active");
      await flushMicrotasks();
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);

    // Locked: a foreground leaves it to the lock transition.
    await act(async () => {
      useAuthenticationStore.setState({ authStatus: AUTH_STATUS.LOCKED });
      await flushMicrotasks();
    });
    mockReconcile.mockClear();
    await act(async () => {
      onChange("background");
      onChange("active");
      await flushMicrotasks();
    });
    expect(mockReconcile).not.toHaveBeenCalled();

    addListener.mockRestore();
    unmount();
  });
});
