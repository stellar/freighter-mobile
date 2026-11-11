import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { dataStorage } from "services/storage/storageFactory";

const LOG_TAG = "rebrandAnnouncement";

/**
 * One-time rebrand announcement: `PENDING` until shown for wallets that pre-date
 * the rebrand, `SEEN` otherwise.
 */
export const REBRAND_ANNOUNCEMENT_STATUS = {
  PENDING: "pending",
  SEEN: "seen",
} as const;

export type RebrandAnnouncementStatus =
  (typeof REBRAND_ANNOUNCEMENT_STATUS)[keyof typeof REBRAND_ANNOUNCEMENT_STATUS];

const hasExistingAccounts = async (): Promise<boolean> => {
  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);

  if (!accountListRaw) {
    return false;
  }

  try {
    const accountList = JSON.parse(accountListRaw) as unknown;

    return Array.isArray(accountList) && accountList.length > 0;
  } catch {
    return false;
  }
};

/**
 * Decides eligibility once per install. Must run at launch, before any wallet
 * can be created or imported; later launches leave the stored answer alone.
 */
export const markRebrandAnnouncementEligibility = async (): Promise<void> => {
  try {
    const currentStatus = await dataStorage.getItem(
      STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS,
    );

    if (currentStatus) {
      return;
    }

    const status: RebrandAnnouncementStatus = (await hasExistingAccounts())
      ? REBRAND_ANNOUNCEMENT_STATUS.PENDING
      : REBRAND_ANNOUNCEMENT_STATUS.SEEN;

    await dataStorage.setItem(STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS, status);
  } catch (error) {
    logger.error(LOG_TAG, "Failed to mark announcement eligibility", error);
  }
};

/** Whether the announcement is still owed. Fails closed on storage errors. */
export const shouldShowRebrandAnnouncement = async (): Promise<boolean> => {
  try {
    const status = await dataStorage.getItem(
      STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS,
    );

    return status === REBRAND_ANNOUNCEMENT_STATUS.PENDING;
  } catch (error) {
    logger.error(LOG_TAG, "Failed to read announcement status", error);

    return false;
  }
};

/** Marks the announcement as shown, or as never to be shown. */
export const markRebrandAnnouncementSeen = async (): Promise<void> => {
  try {
    await dataStorage.setItem(
      STORAGE_KEYS.REBRAND_ANNOUNCEMENT_STATUS,
      REBRAND_ANNOUNCEMENT_STATUS.SEEN,
    );
  } catch (error) {
    logger.error(LOG_TAG, "Failed to mark announcement as seen", error);
  }
};
