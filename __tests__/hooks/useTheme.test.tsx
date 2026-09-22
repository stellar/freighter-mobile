import { renderHook } from "@testing-library/react-hooks";
import {
  DEFAULT_COLOR_SCHEME,
  PALETTE,
  getNotificationVariants,
  getTheme,
} from "config/theme";
import useColors from "hooks/useColors";
import useNotificationVariants from "hooks/useNotificationVariants";
import useTheme from "hooks/useTheme";
import { useColorScheme } from "react-native";

jest.mock("react-native", () => ({
  useColorScheme: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe("useTheme", () => {
  it("returns the dark theme when the device is in dark mode", () => {
    mockUseColorScheme.mockReturnValue("dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.background.default).toBe(
      PALETTE.dark.gray["01"],
    );
  });

  it("returns the light theme when the device is in light mode", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.background.default).toBe(
      PALETTE.light.gray["01"],
    );
  });

  it("falls back to the default scheme when the device reports none", () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual(getTheme(DEFAULT_COLOR_SCHEME));
  });
});

describe("useNotificationVariants", () => {
  it("returns the light variants when the device is in light mode", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useNotificationVariants());

    expect(result.current.success.backgroundColor).toBe(
      PALETTE.light.green["03"],
    );
  });

  it("falls back to the default scheme when the device reports none", () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useNotificationVariants());

    expect(result.current).toEqual(
      getNotificationVariants(DEFAULT_COLOR_SCHEME),
    );
  });
});

describe("color scheme fallback", () => {
  it("resolves the same scheme in useColors and useTheme when none is reported", () => {
    // The two theme systems are read side by side in the same components. If
    // they disagreed on the fallback, a device reporting no scheme would render
    // half the screen light and half dark.
    mockUseColorScheme.mockReturnValue(null);

    const { result: colorsResult } = renderHook(() => useColors());
    const { result: themeResult } = renderHook(() => useTheme());

    expect(themeResult.current.colors.background.default).toBe(
      colorsResult.current.themeColors.gray[1],
    );
  });
});
