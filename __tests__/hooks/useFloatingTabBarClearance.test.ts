import { renderHook } from "@testing-library/react-native";
import {
  useFloatingTabBarClearance,
  useFloatingTabBarTop,
} from "hooks/useFloatingTabBarClearance";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

describe("useFloatingTabBarClearance", () => {
  afterEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue(NO_INSETS);
  });

  it("clears the pill above the bottom inset", () => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      ...NO_INSETS,
      top: 62,
      bottom: 34,
    });

    const { result } = renderHook(() => useFloatingTabBarClearance());

    expect(result.current).toBe(120);
  });

  it("clears the pill 16pt from the edge without an inset", () => {
    const { result } = renderHook(() => useFloatingTabBarClearance());

    expect(result.current).toBe(96);
  });
});

describe("useFloatingTabBarTop", () => {
  afterEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue(NO_INSETS);
  });

  it("is the pill's top edge above the screen's bottom edge", () => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      ...NO_INSETS,
      bottom: 34,
    });

    const { result } = renderHook(() => useFloatingTabBarTop());

    expect(result.current).toBe(104);
  });
});
