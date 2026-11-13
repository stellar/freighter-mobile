import { logger } from "config/logger";
import { removeAllKeystoreEntries } from "helpers/keyManager/ReactNativeKeychainFacade";
import * as Keychain from "react-native-keychain";

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe("removeAllKeystoreEntries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes every keystore entry and the index, indexed or not, and nothing else", async () => {
    (Keychain.getAllGenericPasswordServices as jest.Mock).mockResolvedValue([
      "stellarwallet_index",
      "stellarwallet_indexed-key",
      "stellarwallet_orphaned-key",
      "freighter_secure_storage_hashKey",
      "freighter_biometric_storage_password",
    ]);

    await removeAllKeystoreEntries();

    const removed = (Keychain.resetGenericPassword as jest.Mock).mock.calls.map(
      ([options]: [{ service: string }]) => options.service,
    );
    expect(removed.sort()).toEqual([
      "stellarwallet_index",
      "stellarwallet_indexed-key",
      "stellarwallet_orphaned-key",
    ]);
  });

  // Part of the wipe, which must go on.
  it("logs and resolves when the keychain can't be listed", async () => {
    (Keychain.getAllGenericPasswordServices as jest.Mock).mockRejectedValue(
      new Error("locked"),
    );

    await expect(removeAllKeystoreEntries()).resolves.toBeUndefined();
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
