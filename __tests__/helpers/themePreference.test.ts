import {
  applyThemePreference,
  applyThemePreferenceWithFade,
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
  describe("applyThemePreferenceWithFade", () => {
    const setup = (currentScheme: "light" | "dark") => {
      const beginThemeTransition = jest.fn().mockResolvedValue(true);
      const endThemeTransition = jest.fn();
      setNativeModule({ beginThemeTransition, endThemeTransition });
      jest.spyOn(Appearance, "getColorScheme").mockReturnValue(currentScheme);
      let onChange: (() => void) | undefined;
      jest.spyOn(Appearance, "addChangeListener").mockImplementation((cb) => {
        onChange = () => cb({ colorScheme: null });
        return { remove: jest.fn() };
      });
      const setColorScheme = jest
        .spyOn(Appearance, "setColorScheme")
        .mockImplementation(() => onChange?.());
      return { beginThemeTransition, endThemeTransition, setColorScheme };
    };

    it("freezes the screen, applies, then fades once the scheme changes", async () => {
      const { beginThemeTransition, endThemeTransition, setColorScheme } =
        setup("light");

      await applyThemePreferenceWithFade("dark");

      expect(beginThemeTransition).toHaveBeenCalled();
      expect(setColorScheme).toHaveBeenCalledWith("dark");
      expect(endThemeTransition).toHaveBeenCalledWith(expect.any(Number));
      expect(beginThemeTransition.mock.invocationCallOrder[0]).toBeLessThan(
        setColorScheme.mock.invocationCallOrder[0],
      );
    });

    it("applies without a fade when the scheme won't change", async () => {
      const { beginThemeTransition, setColorScheme } = setup("dark");

      await applyThemePreferenceWithFade("dark");

      expect(beginThemeTransition).not.toHaveBeenCalled();
      expect(setColorScheme).toHaveBeenCalledWith("dark");
    });

    it("applies without a fade when native can't freeze the screen", async () => {
      const { beginThemeTransition, endThemeTransition, setColorScheme } =
        setup("light");
      beginThemeTransition.mockResolvedValue(false);

      await applyThemePreferenceWithFade("dark");

      expect(setColorScheme).toHaveBeenCalledWith("dark");
      expect(endThemeTransition).not.toHaveBeenCalled();
    });

    it("drops a pick a newer one replaced while it waited", async () => {
      const { endThemeTransition, setColorScheme } = setup("light");
      let isWanted = true;
      const pending = applyThemePreferenceWithFade("dark", () => isWanted);
      isWanted = false;

      await pending;

      expect(setColorScheme).not.toHaveBeenCalled();
      expect(endThemeTransition).not.toHaveBeenCalledWith(expect.any(Number));
    });
  });
});
