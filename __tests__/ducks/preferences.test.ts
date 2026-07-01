import { act, renderHook } from "@testing-library/react-hooks";
import { AUTO_LOCK_TIMER, DEFAULT_AUTO_LOCK_TIMER } from "config/constants";
import { usePreferencesStore } from "ducks/preferences";
import {
  applyAutoLockTimerToHashKey,
  persistAutoLockTimer,
} from "services/autoLock";

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  applyAutoLockTimerToHashKey: jest.fn().mockResolvedValue(undefined),
  getAutoLockTimer: jest
    .fn()
    .mockResolvedValue(
      jest.requireActual("config/constants").DEFAULT_AUTO_LOCK_TIMER,
    ),
}));

// setAutoLockTimer sequences the persist + hash-TTL writes in an async IIFE,
// so let those microtasks settle before asserting.
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
    // The hash-key TTL re-anchor is sequenced after the mirror write succeeds
    expect(applyAutoLockTimerToHashKey).toHaveBeenCalledWith(
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
});
