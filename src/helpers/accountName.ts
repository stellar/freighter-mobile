import { ACCOUNT_NAME_MAX_LENGTH } from "config/constants";

/**
 * The default name for a new account: `formatName(N)`, where N starts one
 * past the number of accounts and moves up past any name already in use.
 * Counting from the account total keeps names sequential across the wallet;
 * skipping taken names keeps a renamed or reordered wallet from getting a
 * duplicate.
 *
 * @param existingNames - The names of every account in the wallet
 * @param formatName - Builds the name for a number, e.g. "Account 3"
 */
export const getNextDefaultAccountName = (
  existingNames: string[],
  formatName: (number: number) => string,
): string => {
  const taken = new Set(existingNames);
  const first = existingNames.length + 1;

  // N names can take at most N of the next N + 1 numbers, so one of them is
  // free. Bounded rather than open-ended, so a format that ignores the
  // number can't loop forever.
  for (let offset = 0; offset <= existingNames.length; offset += 1) {
    const name = formatName(first + offset);
    if (!taken.has(name)) {
      return name;
    }
  }

  return formatName(first);
};

/**
 * A caller-supplied name, trimmed and capped at `ACCOUNT_NAME_MAX_LENGTH`, or
 * null when nothing usable is left, so the caller falls back to the default.
 */
export const normalizeAccountName = (name?: string): string | null => {
  const trimmed = (name ?? "").trim().slice(0, ACCOUNT_NAME_MAX_LENGTH);
  return trimmed || null;
};
