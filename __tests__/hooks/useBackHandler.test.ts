import { renderHook } from "@testing-library/react-native";
import useBackHandler from "hooks/useBackHandler";
import { BackHandler } from "react-native";

describe("useBackHandler", () => {
  // The Android back listeners registered, newest last
  let listeners: {
    onBack: () => boolean | null | undefined;
    remove: jest.Mock;
  }[];

  beforeEach(() => {
    listeners = [];
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        const listener = { onBack: handler, remove: jest.fn() };
        listeners.push(listener);

        return { remove: listener.remove };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("listens while enabled and passes on what onBack returns", () => {
    const onBack = jest.fn(() => true);

    renderHook(() => useBackHandler(onBack, true));

    expect(listeners).toHaveLength(1);
    expect(listeners[0].onBack()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("is enabled by default", () => {
    renderHook(() => useBackHandler(() => true));

    expect(listeners).toHaveLength(1);
  });

  it("doesn't listen while disabled", () => {
    renderHook(() => useBackHandler(() => true, false));

    expect(listeners).toHaveLength(0);
  });

  it("starts and stops listening as it is enabled and disabled", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useBackHandler(() => true, enabled),
      { initialProps: { enabled: false } },
    );
    expect(listeners).toHaveLength(0);

    rerender({ enabled: true });
    expect(listeners).toHaveLength(1);

    rerender({ enabled: false });
    expect(listeners[0].remove).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onBack without registering again", () => {
    const { rerender } = renderHook(
      ({ onBack }: { onBack: () => boolean }) => useBackHandler(onBack),
      { initialProps: { onBack: jest.fn(() => true) } },
    );
    const laterOnBack = jest.fn(() => false);

    rerender({ onBack: laterOnBack });

    // Android runs the newest listener first, so registering again would
    // jump ahead of listeners added since
    expect(listeners).toHaveLength(1);
    expect(listeners[0].onBack()).toBe(false);
    expect(laterOnBack).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unmounted", () => {
    const { unmount } = renderHook(() => useBackHandler(() => true));

    unmount();

    expect(listeners[0].remove).toHaveBeenCalledTimes(1);
  });
});
