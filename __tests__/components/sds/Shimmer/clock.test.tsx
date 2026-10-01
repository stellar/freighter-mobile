import { renderHook } from "@testing-library/react-native";
import {
  getShimmerClockState,
  shimmerProgress,
  useShimmerClock,
} from "components/sds/Shimmer/clock";

describe("shimmer clock", () => {
  afterEach(() => {
    // Every test unmounts its hooks; the module must be back at rest.
    expect(getShimmerClockState()).toEqual({ consumers: 0, running: false });
  });

  it("starts on the first enabled consumer and stops on the last", () => {
    const a = renderHook(() => useShimmerClock(true));
    expect(getShimmerClockState()).toEqual({ consumers: 1, running: true });

    const b = renderHook(() => useShimmerClock(true));
    expect(getShimmerClockState()).toEqual({ consumers: 2, running: true });

    a.unmount();
    // Review focus 3: one consumer left, still running.
    expect(getShimmerClockState()).toEqual({ consumers: 1, running: true });

    b.unmount();
    expect(getShimmerClockState()).toEqual({ consumers: 0, running: false });
    expect(shimmerProgress.value).toBe(0);
  });

  it("does not start while disabled (reduced motion)", () => {
    const { unmount } = renderHook(() => useShimmerClock(false));
    expect(getShimmerClockState()).toEqual({ consumers: 0, running: false });
    unmount();
  });

  it("starts when reduced motion turns off after mount, and stops when it turns back on", () => {
    // Review focus 2: the OS answers the reduce-motion query after mount.
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useShimmerClock(enabled),
      { initialProps: { enabled: false } },
    );
    expect(getShimmerClockState().running).toBe(false);

    rerender({ enabled: true });
    expect(getShimmerClockState()).toEqual({ consumers: 1, running: true });

    rerender({ enabled: false });
    expect(getShimmerClockState()).toEqual({ consumers: 0, running: false });
    unmount();
  });
});
