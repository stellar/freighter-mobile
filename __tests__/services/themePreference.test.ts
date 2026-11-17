import { ThemePreference } from "config/themePreference";
import { usePreferencesStore } from "ducks/preferences";
import {
  applyThemePreference,
  saveThemePreference,
} from "helpers/themePreference";
import { Appearance } from "react-native";
import { analytics } from "services/analytics";
import { syncPreferredThemeTrait } from "services/analytics/core";

jest.mock("ducks/preferences", () => {
  let state = { themePreference: "system" };
  return {
    usePreferencesStore: {
      getState: () => state,
      setState: (partial: Partial<typeof state>) => {
        state = { ...state, ...partial };
      },
    },
  };
});
jest.mock("helpers/themePreference", () => ({
  applyThemePreference: jest.fn(),
  saveThemePreference: jest.fn(),
}));
jest.mock("services/analytics", () => ({
  analytics: { trackThemeChanged: jest.fn() },
}));
jest.mock("services/analytics/core", () => ({
  syncPreferredThemeTrait: jest.fn(),
}));

// The module under test is loaded with requireActual: services/* imports are
// mapped to __mocks__ stubs in this repo's Jest config.
const { selectThemePreference } = jest.requireActual<
  typeof import("services/themePreference")
>("../../src/services/themePreference");

const mockApply = applyThemePreference as jest.Mock;
const mockSave = saveThemePreference as jest.Mock;
const mockTrack = analytics.trackThemeChanged as jest.Mock;
const mockSyncTrait = syncPreferredThemeTrait as jest.Mock;

describe("selectThemePreference", () => {
  let colorScheme: "light" | "dark";

  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ themePreference: "system" });
    colorScheme = "light";
    // Stands in for Appearance following the applied preference.
    mockApply.mockImplementation((preference: ThemePreference) => {
      colorScheme = preference === "dark" ? "dark" : "light";
    });
    jest
      .spyOn(Appearance, "getColorScheme")
      .mockImplementation(() => colorScheme);
    mockSave.mockResolvedValue(undefined);
  });

  it("applies before persisting, then reports the change", async () => {
    let appliedAtSave: ThemePreference | undefined;
    mockSave.mockImplementation(() => {
      appliedAtSave = usePreferencesStore.getState().themePreference;
      return Promise.resolve();
    });

    await selectThemePreference("dark");

    expect(mockApply).toHaveBeenCalledWith("dark");
    expect(appliedAtSave).toBe("dark");
    expect(mockTrack).toHaveBeenCalledWith({
      preference: "dark",
      previous: "system",
      colorScheme: "dark",
    });
    expect(mockSyncTrait).toHaveBeenCalledWith("dark", { force: true });
  });

  it("reports nothing when the save fails", async () => {
    mockSave.mockRejectedValue(new Error("disk"));

    await expect(selectThemePreference("dark")).rejects.toThrow("disk");

    expect(mockTrack).not.toHaveBeenCalled();
    expect(mockSyncTrait).not.toHaveBeenCalled();
  });

  it("does nothing when the choice is already in effect", async () => {
    await selectThemePreference("system");
    expect(mockApply).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("labels overlapping picks correctly when saves finish out of order", async () => {
    const pending: Array<() => void> = [];
    mockSave.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );

    const dark = selectThemePreference("dark");
    const light = selectThemePreference("light");
    pending[1]();
    await light;
    pending[0]();
    await dark;

    expect(mockTrack).toHaveBeenNthCalledWith(1, {
      preference: "light",
      previous: "dark",
      colorScheme: "light",
    });
    expect(mockTrack).toHaveBeenNthCalledWith(2, {
      preference: "dark",
      previous: "system",
      colorScheme: "dark",
    });
    expect(mockSyncTrait).toHaveBeenCalledTimes(1);
    expect(mockSyncTrait).toHaveBeenCalledWith("light", { force: true });
  });
});
