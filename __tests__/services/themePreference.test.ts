import { ThemePreference } from "config/themePreference";

jest.mock("ducks/themePreference", () => {
  let state = { themePreference: "system" };
  return {
    useThemePreferenceStore: {
      getState: () => state,
      setState: (partial: Partial<typeof state>) => {
        state = { ...state, ...partial };
      },
    },
  };
});
jest.mock("helpers/themePreference", () => ({
  applyThemePreferenceWithFade: jest.fn(() => Promise.resolve()),
  saveThemePreference: jest.fn(),
  resolveColorScheme: jest.fn(),
}));
jest.mock("services/analytics", () => ({
  analytics: { trackThemeChanged: jest.fn() },
}));
jest.mock("services/analytics/core", () => ({
  syncPreferredThemeTrait: jest.fn(),
}));

type Store = typeof import("ducks/themePreference").useThemePreferenceStore;

describe("selectThemePreference", () => {
  let selectThemePreference: typeof import("services/themePreference").selectThemePreference;
  let store: Store;
  let mockApply: jest.Mock;
  let mockSave: jest.Mock;
  let mockResolve: jest.Mock;
  let mockTrack: jest.Mock;
  let mockSyncTrait: jest.Mock;

  const deferredSaves = () => {
    const pending: Array<{ resolve: () => void; reject: (e: Error) => void }> =
      [];
    mockSave.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    return pending;
  };

  const shown = () => store.getState().themePreference;

  beforeEach(() => {
    // Fresh module per test: it keeps pick bookkeeping between calls. The
    // module under test is loaded with requireActual because services/*
    // imports are mapped to __mocks__ stubs in this repo's Jest config.
    jest.isolateModules(() => {
      ({ selectThemePreference } = jest.requireActual<
        typeof import("services/themePreference")
      >("../../src/services/themePreference"));
      store = jest.requireMock<typeof import("ducks/themePreference")>(
        "ducks/themePreference",
      ).useThemePreferenceStore;
      const helpers = jest.requireMock<Record<string, jest.Mock>>(
        "helpers/themePreference",
      );
      mockApply = helpers.applyThemePreferenceWithFade;
      mockSave = helpers.saveThemePreference;
      mockResolve = helpers.resolveColorScheme;
      mockTrack = jest.requireMock<{
        analytics: Record<string, jest.Mock>;
      }>("services/analytics").analytics.trackThemeChanged;
      mockSyncTrait = jest.requireMock<Record<string, jest.Mock>>(
        "services/analytics/core",
      ).syncPreferredThemeTrait;
    });
    store.setState({ themePreference: "system" });
    mockSave.mockResolvedValue(undefined);
    mockResolve.mockImplementation((preference: ThemePreference) =>
      Promise.resolve(preference === "dark" ? "dark" : "light"),
    );
  });

  it("applies before persisting, then reports the resolved scheme", async () => {
    let shownAtSave: ThemePreference | undefined;
    mockSave.mockImplementation(() => {
      shownAtSave = shown();
      return Promise.resolve();
    });

    await expect(selectThemePreference("dark")).resolves.toBe(true);

    expect(mockApply).toHaveBeenCalledWith("dark", expect.any(Function));
    expect(shownAtSave).toBe("dark");
    expect(mockResolve).toHaveBeenCalledWith("dark");
    expect(mockTrack).toHaveBeenCalledWith({
      preference: "dark",
      previous: "system",
      colorScheme: "dark",
    });
    expect(mockSyncTrait).toHaveBeenCalledWith("dark", { force: true });
  });

  it("does nothing when the choice is already in effect", async () => {
    await expect(selectThemePreference("system")).resolves.toBe(false);
    expect(mockApply).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("restores the saved choice and reports nothing when the save fails", async () => {
    mockSave.mockRejectedValue(new Error("disk"));

    await expect(selectThemePreference("dark")).rejects.toThrow("disk");

    expect(shown()).toBe("system");
    expect(mockApply).toHaveBeenLastCalledWith("system", expect.any(Function));
    expect(mockTrack).not.toHaveBeenCalled();
    expect(mockSyncTrait).not.toHaveBeenCalledWith("dark", expect.anything());
  });

  it("lets the same choice be retried after a failed save", async () => {
    mockSave.mockRejectedValueOnce(new Error("disk"));
    await expect(selectThemePreference("dark")).rejects.toThrow("disk");

    await selectThemePreference("dark");

    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(shown()).toBe("dark");
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("restores the last successful save, not the startup value", async () => {
    await selectThemePreference("light");
    mockSave.mockRejectedValueOnce(new Error("disk"));

    await expect(selectThemePreference("dark")).rejects.toThrow("disk");

    expect(shown()).toBe("light");
  });

  it("keeps a newer pick when an older save fails", async () => {
    const pending = deferredSaves();

    const dark = selectThemePreference("dark");
    const light = selectThemePreference("light");
    pending[0].reject(new Error("disk"));
    await expect(dark).rejects.toThrow("disk");
    pending[1].resolve();
    await light;

    expect(shown()).toBe("light");
    expect(mockSyncTrait).toHaveBeenCalledWith("light", { force: true });
  });

  it("shows an older pick that saves after the newest pick failed", async () => {
    const pending = deferredSaves();

    const dark = selectThemePreference("dark");
    const light = selectThemePreference("light");
    pending[1].reject(new Error("disk"));
    await expect(light).rejects.toThrow("disk");
    expect(shown()).toBe("system");

    pending[0].resolve();
    await dark;

    expect(shown()).toBe("dark");
    expect(mockApply).toHaveBeenLastCalledWith("dark", expect.any(Function));
    expect(mockSyncTrait).toHaveBeenCalledWith("dark", { force: true });
  });

  it("labels overlapping picks correctly when saves finish out of order", async () => {
    const pending = deferredSaves();

    const dark = selectThemePreference("dark");
    const light = selectThemePreference("light");
    pending[1].resolve();
    await light;
    pending[0].resolve();
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
    expect(shown()).toBe("light");
  });
});
