import { STORAGE_KEYS } from "config/constants";
import {
  addHiddenTokenToStorage,
  getSearchTokenRecordId,
  shouldOfferUnhide,
  removeHiddenTokenFromStorage,
  retrieveHiddenTokens,
} from "helpers/hiddenTokens";
import { dataStorage } from "services/storage/storageFactory";

let mockStorage: Record<string, string> = {};

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage[key] ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
  },
}));

jest.mock("config/logger", () => ({
  logger: { error: jest.fn() },
}));

const PUBLIC_KEY = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
const NETWORK = "PUBLIC";
const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const KALE = "KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHDAD2NQMLQ5AE";

const readStorage = () =>
  JSON.parse(mockStorage[STORAGE_KEYS.HIDDEN_TOKEN_LIST] ?? "{}");

describe("hiddenTokens helpers", () => {
  beforeEach(() => {
    mockStorage = {};
    jest.clearAllMocks();
  });

  describe("retrieveHiddenTokens", () => {
    it("returns an empty list when nothing is stored", async () => {
      await expect(
        retrieveHiddenTokens({ publicKey: PUBLIC_KEY, network: NETWORK }),
      ).resolves.toEqual([]);
    });

    it("returns the list for the account and network only", async () => {
      mockStorage[STORAGE_KEYS.HIDDEN_TOKEN_LIST] = JSON.stringify({
        [PUBLIC_KEY]: { [NETWORK]: [USDC], TESTNET: [KALE] },
        GOTHER: { [NETWORK]: [KALE] },
      });

      await expect(
        retrieveHiddenTokens({ publicKey: PUBLIC_KEY, network: NETWORK }),
      ).resolves.toEqual([USDC]);
    });

    it("reads a corrupt entry as nothing hidden", async () => {
      mockStorage[STORAGE_KEYS.HIDDEN_TOKEN_LIST] = "{not json";

      await expect(
        retrieveHiddenTokens({ publicKey: PUBLIC_KEY, network: NETWORK }),
      ).resolves.toEqual([]);
    });
  });

  describe("addHiddenTokenToStorage", () => {
    it("creates the nested entry and persists the token", async () => {
      await addHiddenTokenToStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });

      expect(readStorage()).toEqual({ [PUBLIC_KEY]: { [NETWORK]: [USDC] } });
    });

    it("does not duplicate a token that is already hidden", async () => {
      await addHiddenTokenToStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });
      await addHiddenTokenToStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });

      expect(readStorage()[PUBLIC_KEY][NETWORK]).toEqual([USDC]);
    });

    it("rethrows when the write fails", async () => {
      (dataStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("disk full"),
      );

      await expect(
        addHiddenTokenToStorage({
          publicKey: PUBLIC_KEY,
          network: NETWORK,
          tokenId: USDC,
        }),
      ).rejects.toThrow("disk full");
    });
  });

  describe("removeHiddenTokenFromStorage", () => {
    it("removes the token and keeps the rest", async () => {
      mockStorage[STORAGE_KEYS.HIDDEN_TOKEN_LIST] = JSON.stringify({
        [PUBLIC_KEY]: { [NETWORK]: [USDC, KALE] },
      });

      await removeHiddenTokenFromStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });

      expect(readStorage()).toEqual({ [PUBLIC_KEY]: { [NETWORK]: [KALE] } });
    });

    it("cleans up empty network and account entries", async () => {
      mockStorage[STORAGE_KEYS.HIDDEN_TOKEN_LIST] = JSON.stringify({
        [PUBLIC_KEY]: { [NETWORK]: [USDC] },
      });

      await removeHiddenTokenFromStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });

      expect(readStorage()).toEqual({});
    });

    it("is a no-op when the token is not hidden", async () => {
      await removeHiddenTokenFromStorage({
        publicKey: PUBLIC_KEY,
        network: NETWORK,
        tokenId: USDC,
      });

      expect(dataStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("getSearchTokenRecordId", () => {
    it("uses the bare code for the native record", () => {
      expect(
        getSearchTokenRecordId({
          tokenCode: "XLM",
          issuer: "",
          isNative: true,
        }),
      ).toBe("XLM");
    });

    it("joins code and issuer for everything else", () => {
      expect(
        getSearchTokenRecordId({
          tokenCode: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          isNative: false,
        }),
      ).toBe(USDC);
    });
  });

  describe("shouldOfferUnhide", () => {
    const usdcRecord = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      isNative: false,
    };

    it("is true for a held token the account hid", () => {
      expect(
        shouldOfferUnhide({ ...usdcRecord, hasTrustline: true }, [USDC]),
      ).toBe(true);
    });

    it("is false for a hidden flag left on a token the account no longer holds", () => {
      expect(
        shouldOfferUnhide({ ...usdcRecord, hasTrustline: false }, [USDC]),
      ).toBe(false);
    });

    it("is false for a held token that is not hidden", () => {
      expect(shouldOfferUnhide({ ...usdcRecord, hasTrustline: true }, [])).toBe(
        false,
      );
    });
  });
});
