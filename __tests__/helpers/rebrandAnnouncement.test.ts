import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  REBRAND_ANNOUNCEMENT_STATUS,
  markRebrandAnnouncementEligibility,
  markRebrandAnnouncementSeen,
  shouldShowRebrandAnnouncement,
} from "helpers/rebrandAnnouncement";
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

const KEY = STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS;
const { PENDING, SEEN } = REBRAND_ANNOUNCEMENT_STATUS;

/** Storage with the given status flag and account list. */
const givenStorage = ({
  status,
  accountList,
}: {
  status: string | null;
  accountList: string | null;
}) => {
  mockGetItem.mockImplementation((key: STORAGE_KEYS) => {
    if (key === KEY) return Promise.resolve(status);
    if (key === STORAGE_KEYS.ACCOUNT_LIST) return Promise.resolve(accountList);
    return Promise.resolve(null);
  });
};

const oneAccount = JSON.stringify([{ id: "1", publicKey: "GABC" }]);

describe("rebrandAnnouncement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  describe("markRebrandAnnouncementEligibility", () => {
    it("marks an install with existing accounts as pending (upgrade in place)", async () => {
      givenStorage({ status: null, accountList: oneAccount });

      await markRebrandAnnouncementEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, PENDING);
    });

    it("marks an install with no accounts as seen (fresh install)", async () => {
      givenStorage({ status: null, accountList: null });

      await markRebrandAnnouncementEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it("treats an empty account list as a fresh install", async () => {
      givenStorage({ status: null, accountList: "[]" });

      await markRebrandAnnouncementEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it("treats an unparsable account list as a fresh install", async () => {
      givenStorage({ status: null, accountList: "not json" });

      await markRebrandAnnouncementEligibility();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it.each([PENDING, SEEN])(
      "leaves an existing %s decision alone on later launches, even once accounts exist",
      async (status) => {
        givenStorage({ status, accountList: oneAccount });

        await markRebrandAnnouncementEligibility();

        expect(mockSetItem).not.toHaveBeenCalled();
      },
    );

    it("logs and does not throw when storage fails", async () => {
      mockGetItem.mockRejectedValue(new Error("disk"));

      await expect(
        markRebrandAnnouncementEligibility(),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe("shouldShowRebrandAnnouncement", () => {
    it("is true only while pending", async () => {
      givenStorage({ status: PENDING, accountList: oneAccount });
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(true);

      givenStorage({ status: SEEN, accountList: oneAccount });
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(false);

      givenStorage({ status: null, accountList: oneAccount });
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(false);
    });

    it("fails closed when storage fails", async () => {
      mockGetItem.mockRejectedValue(new Error("disk"));

      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("markRebrandAnnouncementSeen", () => {
    it("persists seen", async () => {
      await markRebrandAnnouncementSeen();

      expect(mockSetItem).toHaveBeenCalledWith(KEY, SEEN);
    });

    it("logs and does not throw when storage fails", async () => {
      mockSetItem.mockRejectedValue(new Error("disk"));

      await expect(markRebrandAnnouncementSeen()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("survives a wallet wipe, so sign-up and import cannot reset the decision", async () => {
      await clearNonSensitiveData();

      const removedKeys = mockRemove.mock.calls.map(([key]) => key);

      expect(removedKeys).toContain(STORAGE_KEYS.ACCOUNT_LIST);
      expect(removedKeys).not.toContain(KEY);
    });

    it("is owed once after an upgrade, then never again across relaunches", async () => {
      // First Varial launch of an upgraded install.
      givenStorage({ status: null, accountList: oneAccount });
      await markRebrandAnnouncementEligibility();
      expect(mockSetItem).toHaveBeenLastCalledWith(KEY, PENDING);

      // Shown.
      givenStorage({ status: PENDING, accountList: oneAccount });
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(true);
      await markRebrandAnnouncementSeen();
      expect(mockSetItem).toHaveBeenLastCalledWith(KEY, SEEN);

      // Relock, unlock, relaunch: the stored answer is final.
      givenStorage({ status: SEEN, accountList: oneAccount });
      mockSetItem.mockClear();
      await markRebrandAnnouncementEligibility();
      expect(mockSetItem).not.toHaveBeenCalled();
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(false);
    });

    it("is never owed to a fresh install, even after it creates a wallet", async () => {
      // First launch, before onboarding.
      givenStorage({ status: null, accountList: null });
      await markRebrandAnnouncementEligibility();
      expect(mockSetItem).toHaveBeenLastCalledWith(KEY, SEEN);

      // Wallet created; next launch finds accounts but the decision is kept.
      givenStorage({ status: SEEN, accountList: oneAccount });
      mockSetItem.mockClear();
      await markRebrandAnnouncementEligibility();
      expect(mockSetItem).not.toHaveBeenCalled();
      await expect(shouldShowRebrandAnnouncement()).resolves.toBe(false);
    });
  });
});
