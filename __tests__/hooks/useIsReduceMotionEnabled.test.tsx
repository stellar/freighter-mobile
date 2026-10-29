import { renderHook, waitFor } from "@testing-library/react-native";
import useIsReduceMotionEnabled from "hooks/useIsReduceMotionEnabled";
import { act } from "react";
import { AccessibilityInfo } from "react-native";

const isReduceMotionEnabled =
  AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const addEventListener = AccessibilityInfo.addEventListener as jest.Mock;

describe("useIsReduceMotionEnabled", () => {
  beforeEach(() => {
    isReduceMotionEnabled.mockResolvedValue(false);
    addEventListener.mockClear();
  });

  it("reports motion reduced until the OS answers", () => {
    // The query settles asynchronously; defaulting to "motion allowed" leaves
    // a window in which an animation can still run for a user who asked for
    // none. A skipped morph in those milliseconds is the cheaper mistake.
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    expect(result.current).toBe(true);
  });

  it("reports the OS setting once it resolves", async () => {
    isReduceMotionEnabled.mockResolvedValue(true);

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("follows the setting being turned on while the screen is open", async () => {
    const remove = jest.fn();
    let notify: ((enabled: boolean) => void) | undefined;
    addEventListener.mockImplementation(
      (event: string, listener: (enabled: boolean) => void) => {
        if (event === "reduceMotionChanged") {
          notify = listener;
        }

        return { remove };
      },
    );

    const { result, unmount } = renderHook(() => useIsReduceMotionEnabled());
    await waitFor(() => expect(result.current).toBe(false));

    act(() => notify!(true));
    expect(result.current).toBe(true);

    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("stays on the OS default when the platform cannot answer", async () => {
    isReduceMotionEnabled.mockRejectedValue(new Error("unsupported"));

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe("useIsReduceMotionEnabled — initial query vs. live events", () => {
  const listenerOf = (mock: jest.Mock) =>
    mock.mock.calls[0][1] as (enabled: boolean) => void;

  beforeEach(() => addEventListener.mockClear());

  it("does not let the initial query overwrite a newer event", async () => {
    // The query reads the setting at mount but settles later. If the user
    // turns reduce motion ON in that window, the listener commits `true` and
    // the query then restores the `false` it read beforehand — so someone who
    // asked for motion to stop keeps getting animation.
    let settleQuery: (enabled: boolean) => void = () => {};
    isReduceMotionEnabled.mockReturnValue(
      new Promise<boolean>((resolve) => {
        settleQuery = resolve;
      }),
    );
    addEventListener.mockReturnValue({ remove: jest.fn() });

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    // The OS reports the change before the mount-time read comes back.
    act(() => {
      listenerOf(addEventListener)(true);
    });
    expect(result.current).toBe(true);

    await act(async () => {
      settleQuery(false);
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it("does not let a failed initial query overwrite a newer event either", async () => {
    // The catch falls back to "motion allowed", which is right for a platform
    // that cannot answer but must not outrank an event that already did.
    let failQuery: (reason?: unknown) => void = () => {};
    isReduceMotionEnabled.mockReturnValue(
      new Promise<boolean>((_resolve, reject) => {
        failQuery = reject;
      }),
    );
    addEventListener.mockReturnValue({ remove: jest.fn() });

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    act(() => {
      listenerOf(addEventListener)(true);
    });

    await act(async () => {
      failQuery(new Error("unsupported"));
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it("still applies the initial query when no event has arrived", async () => {
    isReduceMotionEnabled.mockResolvedValue(false);
    addEventListener.mockReturnValue({ remove: jest.fn() });

    const { result } = renderHook(() => useIsReduceMotionEnabled());

    await waitFor(() => expect(result.current).toBe(false));
  });
});
