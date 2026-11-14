import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { hasExistingAccounts } from "helpers/rebrandAnnouncement";
import { dataStorage } from "services/storage/storageFactory";

const LOG_TAG = "ethenaLaunchPromo";

/**
 * One-time Ethena launch promo: `PENDING` until shown for wallets that existed
 * when the launch version first ran, `SEEN` otherwise. Same rule as the
 * rebrand announcement, so new and imported wallets never get it on their own;
 * the Home banner still opens it.
 */
export const ETHENA_LAUNCH_PROMO_STATUS = {
  PENDING: "pending",
  SEEN: "seen",
} as const;

export type EthenaLaunchPromoStatus =
  (typeof ETHENA_LAUNCH_PROMO_STATUS)[keyof typeof ETHENA_LAUNCH_PROMO_STATUS];

const BANNER_DISMISSED = "true";

/**
 * Decides eligibility once per install. Must run at launch, before any wallet
 * can be created or imported; later launches leave the stored answer alone.
 */
export const markEthenaLaunchPromoEligibility = async (): Promise<void> => {
  try {
    const currentStatus = await dataStorage.getItem(
      STORAGE_KEYS.ETHENA_LAUNCH_PROMO_STATUS,
    );

    if (currentStatus) {
      return;
    }

    const status: EthenaLaunchPromoStatus = (await hasExistingAccounts())
      ? ETHENA_LAUNCH_PROMO_STATUS.PENDING
      : ETHENA_LAUNCH_PROMO_STATUS.SEEN;

    await dataStorage.setItem(STORAGE_KEYS.ETHENA_LAUNCH_PROMO_STATUS, status);
  } catch (error) {
    logger.error(LOG_TAG, "Failed to mark promo eligibility", error);
  }
};

/** Whether the promo is still owed. Fails closed on storage errors. */
export const shouldShowEthenaLaunchPromo = async (): Promise<boolean> => {
  try {
    const status = await dataStorage.getItem(
      STORAGE_KEYS.ETHENA_LAUNCH_PROMO_STATUS,
    );

    return status === ETHENA_LAUNCH_PROMO_STATUS.PENDING;
  } catch (error) {
    logger.error(LOG_TAG, "Failed to read promo status", error);

    return false;
  }
};

/** Marks the promo as shown, or as never to be shown on its own. */
export const markEthenaLaunchPromoSeen = async (): Promise<void> => {
  try {
    await dataStorage.setItem(
      STORAGE_KEYS.ETHENA_LAUNCH_PROMO_STATUS,
      ETHENA_LAUNCH_PROMO_STATUS.SEEN,
    );
  } catch (error) {
    logger.error(LOG_TAG, "Failed to mark promo as seen", error);
  }
};

/**
 * Whether the Home banner was dismissed. A failed read counts as dismissed, so
 * a banner the user closed never comes back because storage hiccuped.
 */
export const isEthenaLaunchBannerDismissed = async (): Promise<boolean> => {
  try {
    const dismissed = await dataStorage.getItem(
      STORAGE_KEYS.ETHENA_LAUNCH_BANNER_DISMISSED,
    );

    return dismissed === BANNER_DISMISSED;
  } catch (error) {
    logger.error(LOG_TAG, "Failed to read banner dismissal", error);

    return true;
  }
};

/** Remembers that the Home banner was dismissed. */
export const dismissEthenaLaunchBanner = async (): Promise<void> => {
  try {
    await dataStorage.setItem(
      STORAGE_KEYS.ETHENA_LAUNCH_BANNER_DISMISSED,
      BANNER_DISMISSED,
    );
  } catch (error) {
    logger.error(LOG_TAG, "Failed to save banner dismissal", error);
  }
};
