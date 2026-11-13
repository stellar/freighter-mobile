import { TFunction } from "i18next";

/**
 * The pool's name as the app shows it, e.g. "Fixed v2.1 Pool".
 *
 * Blend stores each pool's name on-chain when the pool is deployed, and it
 * reaches the app unchanged ("Fixed v2.1"). A name that already ends in the
 * word "pool" is shown as it is, so it never reads "... Pool Pool".
 */
export const getPoolDisplayName = (
  name: string,
  t: TFunction<"translations", undefined>,
): string => {
  const trimmed = name.trim();
  if (/(^|\s)pool$/i.test(trimmed)) {
    return trimmed;
  }
  return t("earnPoolDetails.poolName", { name: trimmed });
};
