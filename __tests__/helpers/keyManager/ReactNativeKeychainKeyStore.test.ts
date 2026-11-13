import { EncryptedKey } from "@stellar/typescript-wallet-sdk-km";
import { ReactNativeKeychainKeyStore } from "helpers/keyManager/ReactNativeKeychainKeyStore";

const mockFacade = {
  configure: jest.fn(),
  hasKey: jest.fn(),
  setKey: jest.fn(),
  addToKeyIndex: jest.fn(),
  removeKey: jest.fn(),
};
jest.mock("helpers/keyManager/ReactNativeKeychainFacade", () => ({
  ReactNativeKeychainFacade: jest.fn(() => mockFacade),
}));

const encryptedKey = (id: string) => ({ id }) as unknown as EncryptedKey;

describe("ReactNativeKeychainKeyStore.storeKeys", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFacade.hasKey.mockResolvedValue(false);
    mockFacade.setKey.mockResolvedValue(undefined);
    mockFacade.addToKeyIndex.mockResolvedValue(undefined);
    mockFacade.removeKey.mockResolvedValue(undefined);
  });

  it("stores and indexes each key", async () => {
    const store = new ReactNativeKeychainKeyStore();

    await expect(
      store.storeKeys([encryptedKey("a"), encryptedKey("b")]),
    ).resolves.toEqual([{ id: "a" }, { id: "b" }]);

    expect(mockFacade.addToKeyIndex.mock.calls).toEqual([["a"], ["b"]]);
    expect(mockFacade.removeKey).not.toHaveBeenCalled();
  });

  // Wipes find keys through the index; an unindexed entry would outlive them.
  it("removes the entry it just wrote when indexing it fails, and rethrows", async () => {
    const indexError = new Error("index write failed");
    mockFacade.addToKeyIndex
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(indexError);
    const store = new ReactNativeKeychainKeyStore();

    await expect(
      store.storeKeys([encryptedKey("a"), encryptedKey("b")]),
    ).rejects.toBe(indexError);

    // Only the unindexed one: "a" is indexed, so a wipe still finds it.
    expect(mockFacade.removeKey.mock.calls).toEqual([["b"]]);
  });

  it("still rethrows the index error when removing the entry fails", async () => {
    const indexError = new Error("index write failed");
    mockFacade.addToKeyIndex.mockRejectedValue(indexError);
    // The facade logs and swallows its own removal failures.
    mockFacade.removeKey.mockResolvedValue(undefined);
    const store = new ReactNativeKeychainKeyStore();

    await expect(store.storeKeys([encryptedKey("a")])).rejects.toBe(indexError);
    expect(mockFacade.removeKey).toHaveBeenCalledWith("a");
  });
});
