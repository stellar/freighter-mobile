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
}));

describe("preferences store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults the auto-lock timer to 24 hours", () => {
    const { result } = renderHook(() => usePreferencesStore());

    expect(result.current.autoLockTimer).toBe(DEFAULT_AUTO_LOCK_TIMER);
    expect(result.current.autoLockTimer).toBe(
      AUTO_LOCK_TIMER.TWENTY_FOUR_HOURS,
    );
  });

  it("updates the auto-lock timer and writes through to the mirror", () => {
    const { result } = renderHook(() => usePreferencesStore());

    act(() => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
    });

    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.FIFTEEN_MINUTES);
    expect(persistAutoLockTimer).toHaveBeenCalledWith(
      AUTO_LOCK_TIMER.FIFTEEN_MINUTES,
    );
    expect(applyAutoLockTimerToHashKey).toHaveBeenCalledWith(
      AUTO_LOCK_TIMER.FIFTEEN_MINUTES,
    );
  });

  it("reverts the auto-lock timer when the mirror write fails", async () => {
    const { result } = renderHook(() => usePreferencesStore());

    act(() => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.ONE_HOUR);
    });
    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.ONE_HOUR);

    (persistAutoLockTimer as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await act(async () => {
      result.current.setAutoLockTimer(AUTO_LOCK_TIMER.ONE_MINUTE);
      // Allow the rejected persist promise to settle and trigger the revert
      await Promise.resolve();
    });

    // The displayed selection must never disagree with the enforced mirror
    expect(result.current.autoLockTimer).toBe(AUTO_LOCK_TIMER.ONE_HOUR);
  });
});
