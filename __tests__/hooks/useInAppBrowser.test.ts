import { renderHook } from "@testing-library/react-hooks";
import { getThemeColors } from "config/colors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { Linking, useColorScheme } from "react-native";
import { InAppBrowser } from "react-native-inappbrowser-reborn";

jest.mock("react-native", () => ({
  useColorScheme: jest.fn(),
  Linking: { openURL: jest.fn() },
}));

jest.mock("react-native-inappbrowser-reborn", () => ({
  InAppBrowser: {
    isAvailable: jest.fn(() => Promise.resolve(true)),
    open: jest.fn(() => Promise.resolve({ type: "dismiss" })),
    closeAuth: jest.fn(),
  },
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockOpen = InAppBrowser.open as jest.MockedFunction<
  typeof InAppBrowser.open
>;

/** Opens a URL and hands back the options the native module received. */
const optionsFor = async (scheme: "light" | "dark") => {
  mockUseColorScheme.mockReturnValue(scheme);

  const { result } = renderHook(() => useInAppBrowser());
  await result.current.open("https://example.com");

  return mockOpen.mock.calls[0][1] as Record<string, unknown>;
};

describe("useInAppBrowser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("leaves the iOS bar colors to Safari", async () => {
    // SFSafariViewController renders out of process, so the app cannot read
    // the page it is showing. Safari tints its own bars from the site's
    // rendered background; pinning them here would instead paint the app's
    // background above a page that may be the opposite brightness.
    const options = await optionsFor("light");

    expect(options).not.toHaveProperty("preferredBarTintColor");
    expect(options).not.toHaveProperty("preferredControlTintColor");
  });

  it.each(["light", "dark"] as const)(
    "tints the Android toolbar with the %s theme",
    async (scheme) => {
      // Custom Tabs has no equivalent: it shows whatever color it is given, so
      // following the device is the closest the toolbar can get.
      const options = await optionsFor(scheme);

      expect(options.toolbarColor).toBe(
        getThemeColors(scheme).background.primary,
      );
    },
  );

  // iOS keeps a flag for the browser it presented, cleared only when that
  // browser reports closing. One that went away without reporting it leaves
  // the flag set, and every later open fails while nothing is on screen.
  describe("a browser session iOS still thinks is open", () => {
    const staleSessionError = Object.assign(
      new Error("Another InAppBrowser is already being presented."),
      { code: "RNInAppBrowser" },
    );

    it("clears it and opens in the app, not in Safari", async () => {
      mockUseColorScheme.mockReturnValue("light");
      mockOpen.mockRejectedValueOnce(staleSessionError);

      const { result } = renderHook(() => useInAppBrowser());
      await result.current.open("https://mainnet.blend.capital/");

      expect(InAppBrowser.closeAuth).toHaveBeenCalledTimes(1);
      expect(mockOpen).toHaveBeenCalledTimes(2);
      expect(mockOpen.mock.calls[1][0]).toBe("https://mainnet.blend.capital/");
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it("still falls back to Safari when the second open fails too", async () => {
      mockUseColorScheme.mockReturnValue("light");
      mockOpen
        .mockRejectedValueOnce(staleSessionError)
        .mockRejectedValueOnce(new Error("boom"));

      const { result } = renderHook(() => useInAppBrowser());
      await expect(
        result.current.open("https://mainnet.blend.capital/"),
      ).rejects.toThrow("boom");

      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://mainnet.blend.capital/",
      );
    });
  });

  it("falls back to Safari on any other failure, without resetting", async () => {
    mockUseColorScheme.mockReturnValue("light");
    mockOpen.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useInAppBrowser());
    await expect(result.current.open("https://example.com")).rejects.toThrow(
      "boom",
    );

    expect(InAppBrowser.closeAuth).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
  });
});
