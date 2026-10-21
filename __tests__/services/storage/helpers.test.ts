import {
  clearTemporaryData,
  getWipeGeneration,
} from "services/storage/helpers";
import { secureDataStorage } from "services/storage/storageFactory";

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  secureDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("storage helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("wipe generation", () => {
    it("bumps synchronously when a wipe begins, before any remove lands", async () => {
      const before = getWipeGeneration();

      // Hold the removes open so the wipe is genuinely in flight.
      const releaseRemoves: Array<() => void> = [];
      (secureDataStorage.remove as jest.Mock).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRemoves.push(resolve);
          }),
      );

      const wipe = clearTemporaryData();

      // An in-flight opportunistic writer (the hash-key re-anchor) checking
      // the generation now — mid-wipe — must already see it moved.
      expect(getWipeGeneration()).toBe(before + 1);

      releaseRemoves.forEach((release) => release());
      await wipe;
      expect(getWipeGeneration()).toBe(before + 1);
    });
  });
});
