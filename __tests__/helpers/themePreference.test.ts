import {
  applyThemePreference,
  getStoredThemePreference,
  resolveColorScheme,
  saveThemePreference,
} from "helpers/themePreference";
import { Appearance, NativeModules } from "react-native";

describe("themePreference helpers", () => {
  const setNativeModule = (module: unknown) => {
    (NativeModules as Record<string, unknown>).ThemePreference = module;
  };

  afterEach(() => {
    setNativeModule(undefined);
    jest.restoreAllMocks();
  });

  describe("getStoredThemePreference", () => {
    it("returns the natively stored choice", () => {
      setNativeModule({ initialThemePreference: "dark" });
      expect(getStoredThemePreference()).toBe("dark");
    });

    it("falls back to system for an unknown value", () => {
      setNativeModule({ initialThemePreference: "sepia" });
      expect(getStoredThemePreference()).toBe("system");
    });

    it("falls back to system without the native module", () => {
      expect(getStoredThemePreference()).toBe("system");
    });
  });

  describe("applyThemePreference", () => {
    it("pins light and dark, and clears the pin for system", () => {
      const setColorScheme = jest
        .spyOn(Appearance, "setColorScheme")
        .mockImplementation(() => {});

      applyThemePreference("dark");
      applyThemePreference("light");
      applyThemePreference("system");

      expect(setColorScheme.mock.calls).toEqual([["dark"], ["light"], [null]]);
    });
  });

  describe("saveThemePreference", () => {
    it("writes through the native module", async () => {
      const setThemePreference = jest.fn().mockResolvedValue("dark");
      setNativeModule({ setThemePreference });

      await saveThemePreference("dark");

      expect(setThemePreference).toHaveBeenCalledWith("dark");
    });

    it("throws when the native write fails", async () => {
      setNativeModule({
        setThemePreference: jest.fn().mockRejectedValue(new Error("disk")),
      });
      await expect(saveThemePreference("dark")).rejects.toThrow("disk");
    });

    it("throws without the native module", async () => {
      await expect(saveThemePreference("dark")).rejects.toThrow(
        "ThemePreference native module is unavailable",
      );
    });
  });

  describe("resolveColorScheme", () => {
    it("uses a pinned choice without asking native or Appearance", async () => {
      const getSystemColorScheme = jest.fn();
      setNativeModule({ getSystemColorScheme });
      jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");

      await expect(resolveColorScheme("dark")).resolves.toBe("dark");
      await expect(resolveColorScheme("light")).resolves.toBe("light");
      expect(getSystemColorScheme).not.toHaveBeenCalled();
    });

    it("asks native for the device scheme for system, not Appearance", async () => {
      setNativeModule({
        getSystemColorScheme: jest.fn().mockResolvedValue("dark"),
      });
      jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");

      await expect(resolveColorScheme("system")).resolves.toBe("dark");
    });

    it.each([
      ["the module is missing", undefined],
      [
        "the native call fails",
        { getSystemColorScheme: jest.fn().mockRejectedValue(new Error("x")) },
      ],
      [
        "native returns an unknown value",
        { getSystemColorScheme: jest.fn().mockResolvedValue("sepia") },
      ],
    ])("falls back to Appearance when %s", async (_case, module) => {
      setNativeModule(module);
      jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");

      await expect(resolveColorScheme("system")).resolves.toBe("dark");
    });
  });
});
