import type * as ReactNative from "react-native";

type EthenaLaunchConfig =
  typeof import("components/screens/EthenaLaunchScreen/ethenaLaunchConfig");

// The fade's length is read once, when the config loads, so each platform
// gets a fresh copy of the module.
const fadeOn = (os: "ios" | "android") => {
  let fade: number | undefined;
  jest.isolateModules(() => {
    const { Platform } = jest.requireActual<typeof ReactNative>("react-native");
    jest.replaceProperty(Platform, "OS", os);
    fade = jest.requireActual<EthenaLaunchConfig>(
      "components/screens/EthenaLaunchScreen/ethenaLaunchConfig",
    ).ETHENA_LAUNCH_FADE_MS;
  });
  return fade;
};

describe("ETHENA_LAUNCH_FADE_MS", () => {
  it("keeps each platform's own fade: 500ms on iOS, 150ms on Android", () => {
    expect(fadeOn("ios")).toBe(500);
    expect(fadeOn("android")).toBe(150);
  });
});
