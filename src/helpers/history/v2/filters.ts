/**
 * Client-side filters over the normalized history model, mirroring the v1
 * behaviors (dust hiding via the isHideDustEnabled setting).
 *
 * Claimable-balance spam filtering (v1: create_claimable_balance ops in
 * transactions with >50 operations) is not portable yet — the v2 payload only
 * carries the queried account's operations, not the transaction's total
 * operation count. Covered by the backend follow-up in
 * docs/superpowers/plans/2026-08-10-history-v2-data-layer.md.
 */
import BigNumber from "bignumber.js";
import { HistoryEntry } from "helpers/history/v2/model";

const DUST_THRESHOLD = new BigNumber(0.1);

/** Mirrors v1 getIsDustPayment: native credit to the account ≤ 0.1 XLM */
const isDustEntry = (
  entry: HistoryEntry,
  nativeTokenId: string | null,
): boolean => {
  if (
    entry.kind !== "received" ||
    entry.details.balanceChanges.length !== 1 ||
    entry.details.balanceChanges[0].token.contractId !== nativeTokenId
  ) {
    return false;
  }
  // an amount we couldn't scale is not something we can call dust
  const { amount } = entry.details.balanceChanges[0];
  return amount !== null && new BigNumber(amount).lte(DUST_THRESHOLD);
};

export const filterHistoryEntries = (
  entries: HistoryEntry[],
  {
    isHideDustEnabled,
    nativeTokenId,
  }: { isHideDustEnabled: boolean; nativeTokenId: string | null },
): HistoryEntry[] =>
  isHideDustEnabled
    ? entries.filter((entry) => !isDustEntry(entry, nativeTokenId))
    : entries;

/**
 * Filters entries to those that moved a given token, for the token-detail
 * screen. New in mobile: the extension has no per-token history view, so its
 * filters.ts has no counterpart.
 *
 * Matches on balance-change token contract ids. An empty tokenId means "no
 * filter" and returns the input untouched, mirroring how the v1 path treats an
 * absent tokenId.
 */
export const filterHistoryEntriesByToken = (
  entries: HistoryEntry[],
  tokenId: string,
): HistoryEntry[] => {
  if (!tokenId) {
    return entries;
  }
  return entries.filter((entry) =>
    entry.details.balanceChanges.some(
      (row) => row.token.contractId === tokenId,
    ),
  );
};
