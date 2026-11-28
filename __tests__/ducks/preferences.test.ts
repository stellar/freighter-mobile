import { act, renderHook } from "@testing-library/react-hooks";
import { AUTO_LOCK_TIMER, DEFAULT_AUTO_LOCK_TIMER } from "config/constants";
import { usePreferencesStore } from "ducks/preferences";
import { persistAutoLockTimer } from "services/autoLock";

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  getAutoLockTimer: jest
    .fn()
    .mockResolvedValue(
      jest.requireActual("config/constants").DEFAULT_AUTO_LOCK_TIMER,
    ),
}));

// setAutoLockTimer persists to the mirror in a fire-and-forget promise, so let
// those microtasks settle before asserting.
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe("preferences store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults the auto-lock timer to 12 hours", () => {
    const { result } = renderHook(() => usePreferencesStore());

    expect(result.current.autoLockTimer).toBe(DEFAULT_AUTO_LOCK_TIMER);
    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.TWELVE_HOURS);
  });

  it("updates the auto-lock timer and writes through to the mirror", async () => {
    const { result } = renderHook(() => usePreferencesStore());

    await act(async () => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
      await flushMicrotasks();
    });

    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
    expect(persistAutoLockTimer).toHaveBeenCalledWith(
      AUTO_LOCK_TIMER.FIFTEEN_MINUTES,
    );
  });

  it("reverts the auto-lock timer when the mirror write fails", async () => {
    const { result } = renderHook(() => usePreferencesStore());

    await act(async () => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.ONE_HOUR);
      await flushMicrotasks();
    });
    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.ONE_HOUR);

    (persistAutoLockTimer as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await act(async () => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.ONE_MINUTE);
      // Allow the rejected persist promise to settle and trigger the revert
      await flushMicrotasks();
    });

    // The displayed selection must never disagree with the enforced mirror
    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.ONE_HOUR);
  });

  it("hydrates the auto-lock timer from the secure mirror", async () => {
    const { getAutoLockTimer } = jest.requireMock("services/autoLock");
    getAutoLockTimer.mockResolvedValueOnce(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
    const { result } = renderHook(() => usePreferencesStore());

    await act(async () => {
      await result.current.hydrateAutoLockTimer();
    });

    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
  });

  describe("hasSeenEarnIntro", () => {
    it("defaults to false", () => {
      const { result } = renderHook(() => usePreferencesStore());

      expect(result.current.hasSeenEarnIntro).toBe(false);
    });

    it("is set via setHasSeenEarnIntro", () => {
      const { result } = renderHook(() => usePreferencesStore());

      act(() => {
        result.current.setHasSeenEarnIntro(true);
      });

      expect(result.current.hasSeenEarnIntro).toBe(true);
    });

    it("is included in the persisted (partialized) state, so it survives a rehydrate", () => {
      const { result } = renderHook(() => usePreferencesStore());

      act(() => {
        result.current.setHasSeenEarnIntro(true);
      });

      // Exercises the same `partialize` function the `persist` middleware
      // calls before writing to storage -- if `hasSeenEarnIntro` were
      // missing from its allowlist, this would come back without the key
      // and the flag would revert to false on every app launch, showing the
      // intro every time despite the user having dismissed it.
      const persistedState = usePreferencesStore.persist
        .getOptions()
        .partialize?.(usePreferencesStore.getState()) as {
        hasSeenEarnIntro?: boolean;
      };

      expect(persistedState.hasSeenEarnIntro).toBe(true);
    });
  });
});
