import { act, renderHook } from "@testing-library/react-native";
import { SPLASH_TOTAL_MS } from "components/SplashAnimation/splashTimeline";
import { useSplashSequence } from "components/SplashAnimation/useSplashSequence";

describe("useSplashSequence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("plays the whole animation even when the app is ready immediately", () => {
    const onFinished = jest.fn();

    renderHook(() => useSplashSequence({ ready: true, onFinished }));
    act(() => {
      jest.advanceTimersByTime(SPLASH_TOTAL_MS - 1);
    });

    expect(onFinished).not.toHaveBeenCalled();
  });

  it("finishes once the animation completes and the app is ready", () => {
    const onFinished = jest.fn();

    renderHook(() => useSplashSequence({ ready: true, onFinished }));
    act(() => {
      jest.advanceTimersByTime(SPLASH_TOTAL_MS);
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting past the animation while the app is still starting", () => {
    const onFinished = jest.fn();

    renderHook(() => useSplashSequence({ ready: false, onFinished }));
    act(() => {
      jest.advanceTimersByTime(SPLASH_TOTAL_MS * 3);
    });

    expect(onFinished).not.toHaveBeenCalled();
  });

  it("finishes as soon as a slow app becomes ready after the animation", () => {
    const onFinished = jest.fn();
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useSplashSequence({ ready, onFinished }),
      { initialProps: { ready: false } },
    );

    act(() => {
      jest.advanceTimersByTime(SPLASH_TOTAL_MS * 2);
    });
    expect(onFinished).not.toHaveBeenCalled();

    rerender({ ready: true });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("only finishes once even if ready keeps re-rendering", () => {
    const onFinished = jest.fn();
    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useSplashSequence({ ready, onFinished }),
      { initialProps: { ready: false } },
    );

    act(() => {
      jest.advanceTimersByTime(SPLASH_TOTAL_MS);
    });
    rerender({ ready: true });
    rerender({ ready: true });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
