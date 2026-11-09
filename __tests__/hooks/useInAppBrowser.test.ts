import { renderHook } from "@testing-library/react-hooks";
import { getThemeColors } from "config/colors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useColorScheme } from "react-native";
import { InAppBrowser } from "react-native-inappbrowser-reborn";

jest.mock("react-native", () => ({
  useColorScheme: jest.fn(),
  Linking: { openURL: jest.fn() },
}));

jest.mock("react-native-inappbrowser-reborn", () => ({
  InAppBrowser: {
    isAvailable: jest.fn(() => Promise.resolve(true)),
    open: jest.fn(() => Promise.resolve({ type: "dismiss" })),
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
});
