import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  dismissEthenaLaunchBanner,
  isEthenaLaunchBannerDismissed,
  markEthenaLaunchPromoEligibility,
  markEthenaLaunchPromoSeen,
  shouldShowEthenaLaunchPromo,
} from "helpers/ethenaLaunchPromo";
import { clearNonSensitiveData } from "services/storage/helpers";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
  secureDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockGetItem = dataStorage.getItem as jest.Mock;
const mockSetItem = dataStorage.setItem as jest.Mock;
const mockRemove = dataStorage.remove as jest.Mock;

// Literal keys and values: renaming either would re-arm the promo (or bring
// back a dismissed banner) for every existing install.
const KEY = "ethenaLaunchPromoStatus";
const DISMISSED_KEY = "ethenaLaunchBannerDismissed";
const PENDING = "pending";
const SEEN = "seen";
const ACCOUNT_LIST_KEY: string = STORAGE_KEYS.ACCOUNT_LIST;

/** Storage with the given promo status, account list and banner flag. */
const givenStorage = ({
  status = null,
  accountList = null,
  dismissed = null,
}: {
  status?: string | null;
  accountList?: string | null;
  dismissed?: string | null;
}) => {
  mockGetItem.mockImplementation((key: string) => {
    if (key === KEY) return Promise.resolve(status);
    if (key === ACCOUNT_LIST_KEY) return Promise.resolve(accountList);
    if (key === DISMISSED_KEY) return Promise.resolve(dismissed);
    return Promise.resolve(null);
  });
};

const oneAccount = JSON.stringify([{ id: "1", publicKey: "GABC" }]);

describe("ethenaLaunchPromo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  describe("markEthenaLaunchPromoEligibility", () => {
    it("marks an install with existing accounts as pending (upgrade in place)", async () => {
      givenStorage({ accountList: oneAccount });

      await markEthenaLaunchPromoEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, PENDING);
    });

    it("marks an install with no accounts as seen (fresh install)", async () => {
      givenStorage({ accountList: null });

      await markEthenaLaunchPromoEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it.each(["[]", "not json"])(
      "treats the account list %p as a fresh install",
      async (accountList) => {
        givenStorage({ accountList });

        await markEthenaLaunchPromoEligibility();

        expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
      },
    );

    it.each([PENDING, SEEN])(
      "leaves a stored %s status alone, even once accounts exist",
      async (status) => {
        givenStorage({ status, accountList: oneAccount });

        await markEthenaLaunchPromoEligibility();

        expect(mockSetItem).not.toHaveBeenCalled();
      },
    );

    it("logs and does not throw when storage fails", async () => {
      mockGetItem.mockRejectedValue(new Error("disk"));

      await expect(markEthenaLaunchPromoEligibility()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe("shouldShowEthenaLaunchPromo", () => {
    it("is true only while pending", async () => {
      givenStorage({ status: PENDING, accountList: oneAccount });
      await expect(shouldShowEthenaLaunchPromo()).resolves.toBe(true);

      givenStorage({ status: SEEN, accountList: oneAccount });
      await expect(shouldShowEthenaLaunchPromo()).resolves.toBe(false);

      givenStorage({ status: null, accountList: oneAccount });
      await expect(shouldShowEthenaLaunchPromo()).resolves.toBe(false);
    });

    it("fails closed when storage fails", async () => {
      mockGetItem.mockRejectedValue(new Error("disk"));

      await expect(shouldShowEthenaLaunchPromo()).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("markEthenaLaunchPromoSeen", () => {
    it("persists seen", async () => {
      await markEthenaLaunchPromoSeen();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it("logs and does not throw when storage fails", async () => {
      mockSetItem.mockRejectedValue(new Error("disk"));

      await expect(markEthenaLaunchPromoSeen()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("banner dismissal", () => {
    it("is not dismissed until dismissEthenaLaunchBanner runs", async () => {
      givenStorage({ dismissed: null });

      await expect(isEthenaLaunchBannerDismissed()).resolves.toBe(false);
    });

    it("persists the dismissal", async () => {
      await dismissEthenaLaunchBanner();

      expect(mockSetItem).toHaveBeenCalledWith(DISMISSED_KEY, "true");

      givenStorage({ dismissed: "true" });
      await expect(isEthenaLaunchBannerDismissed()).resolves.toBe(true);
    });

    it("treats a failed read as dismissed, so a dismissed banner never returns", async () => {
      mockGetItem.mockRejectedValue(new Error("disk"));

      await expect(isEthenaLaunchBannerDismissed()).resolves.toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it("logs and does not throw when the dismissal can't be saved", async () => {
      mockSetItem.mockRejectedValue(new Error("disk"));

      await expect(dismissEthenaLaunchBanner()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("survives a wallet wipe, so sign-up and import cannot re-arm it", async () => {
      await clearNonSensitiveData();

      const removedKeys = mockRemove.mock.calls.map(([key]) => key);

      expect(removedKeys).toContain(STORAGE_KEYS.ACCOUNT_LIST);
      expect(removedKeys).not.toContain(KEY);
    });

    it("clears the banner dismissal on a wallet wipe", async () => {
      await clearNonSensitiveData();

      const removedKeys = mockRemove.mock.calls.map(([key]) => key);

      expect(removedKeys).toContain(DISMISSED_KEY);
    });
  });
});
