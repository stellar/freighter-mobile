import { Account } from "config/types";
import { t } from "i18next";

/*
  Account identity is `Account.id`, the keystore id as persisted in the account
  list and as ACTIVE_ACCOUNT_ID. Nothing resolves an account by its position in
  `allAccounts`: that order is presentation only. A lookup that finds nothing
  is a bug upstream and must surface, never fall back to the first account.
*/

const assertHasId = (account: Account): Account => {
  if (!account.id) {
    throw new Error(t("authStore.error.accountNotFound"));
  }
  return account;
};

/** The first account with `publicKey`. Throws when there is none. */
export const findAccountByPublicKey = (
  allAccounts: Account[],
  publicKey: string,
): Account => {
  const account = allAccounts.find((a) => a.publicKey === publicKey);
  if (!account) {
    throw new Error(t("authStore.error.accountNotFound"));
  }
  return assertHasId(account);
};

/** The account with keystore id `id`. Throws when there is none. */
export const findAccountById = (
  allAccounts: Account[],
  id: string,
): Account => {
  const account = allAccounts.find((a) => a.id === id);
  if (!account) {
    throw new Error(t("authStore.error.accountNotFound"));
  }
  return assertHasId(account);
};
