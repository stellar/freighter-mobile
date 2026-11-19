import { BigNumber } from "bignumber.js";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { BalanceMap, PricedBalanceMap, TokenPricesMap } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { isNativeAssetId, isNativeBalance } from "helpers/assetIdentity";
import { getTokenIdentifier, sumVisibleFiatTotals } from "helpers/balances";
import { getBalanceInWholeUnits } from "helpers/formatAmount";
import { DEBUG_CONFIG } from "services/analytics/constants";
import {
  canSendAnalytics,
  getAccountIdHash,
  syncIdentifyTraits,
  track,
} from "services/analytics/core";
import {
  FundingRecord,
  loadFundingRecord,
  saveFundingRecord,
  withFundingRecordLock,
} from "services/analytics/fundingRecords";

/**
 * `account.funded` detection and the `funded_account_count` user property.
 *
 * Funded means that the USD value of the account is greater than zero. It is
 * not the backend `isFunded` flag, which only means that the account exists on
 * the ledger. Only PUBLIC has prices, so all of this runs on PUBLIC only.
 *
 * Design: wallet-eng-monorepo `design-docs/account-funded/requirements.md`.
 */

export interface FundedStateInput {
  /** The backend flag: the account exists on the ledger. */
  isFunded: boolean | null | undefined;
  /** The balance fetch failed. */
  hasBalanceError: boolean;
  /** The price fetch failed. */
  hasPriceError: boolean;
  /** The account holds XLM above zero, and the price data has no XLM price. */
  hasUnpricedXlm: boolean;
  /** The USD value of the balances that count. */
  totalUsd: BigNumber;
}

/**
 * The funded rule.
 *
 * @returns true for funded, false for unfunded, and null when the input
 *   gives no definite result
 */
export const getFundedState = ({
  isFunded,
  hasBalanceError,
  hasPriceError,
  hasUnpricedXlm,
  totalUsd,
}: FundedStateInput): boolean | null => {
  // No ledger entry, so no balances. No prices are necessary.
  if (isFunded === false) return false;
  if (hasBalanceError || isFunded == null) return null;
  if (hasPriceError) return null;
  // XLM always has a price on mainnet. A missing XLM price means incomplete
  // price data, not a zero value.
  if (hasUnpricedXlm) return null;

  return totalUsd.isGreaterThan(0);
};

const isActiveAccount = (publicKey: string, network: NETWORKS): boolean => {
  const { account, network: activeNetwork } = useAuthenticationStore.getState();

  return account?.publicKey === publicKey && activeNetwork === network;
};

const isOwnAccount = (publicKey: string): boolean =>
  useAuthenticationStore
    .getState()
    .allAccounts.some((account) => account.publicKey === publicKey);

const syncFundedAccountCount = () => {
  syncIdentifyTraits(useAuthenticationStore.getState().allAccounts);
};

/**
 * Emits `account.funded` when analytics can send it.
 *
 * @returns Whether the event was sent. False when consent dropped it.
 */
const emitAccountFunded = (): boolean => {
  if (!canSendAnalytics()) return false;

  track(AnalyticsEvent.ACCOUNT_FUNDED);
  return true;
};

/**
 * Applies a definite result from the active-account fetch to the record of
 * that account, and emits `account.funded` on a transition to funded.
 *
 * The caller has already checked that the network is PUBLIC.
 */
export const applyActiveAccountFundedState = async ({
  publicKey,
  network,
  funded,
}: {
  publicKey: string;
  network: NETWORKS;
  funded: boolean;
}): Promise<void> => {
  if (!isActiveAccount(publicKey, network)) return;

  const accountIdHash = getAccountIdHash(publicKey);
  if (!accountIdHash) return;

  await withFundingRecordLock(network, accountIdHash, async () => {
    // Check again after the lock. An account switch during the wait must not
    // emit an event with the common context of another account.
    if (!isActiveAccount(publicKey, network)) return;

    const record: FundingRecord =
      (await loadFundingRecord(network, accountIdHash)) ?? {};
    const previousStatus = record.status;

    record.funded = funded;

    if (previousStatus === undefined) {
      // First result for this account: no event. An imported account that is
      // already funded never emits for that funding.
      record.status = funded ? "funded" : "unfunded";
    } else if (!funded) {
      record.status = "unfunded";
    } else if (previousStatus !== "funded") {
      // unfunded or pending, then funded: the transition to report.
      record.status = emitAccountFunded() ? "funded" : "pending";
    }

    await saveFundingRecord(network, accountIdHash, record);
  });

  syncFundedAccountCount();
};

/**
 * Applies a definite result from the all-accounts fetch. It changes only
 * `funded`, never `status`, so it cannot create or consume an event.
 */
export const applyListAccountFundedState = async ({
  publicKey,
  network,
  funded,
}: {
  publicKey: string;
  network: NETWORKS;
  funded: boolean;
}): Promise<void> => {
  if (network !== NETWORKS.PUBLIC || !isOwnAccount(publicKey)) return;

  const accountIdHash = getAccountIdHash(publicKey);
  if (!accountIdHash) return;

  const changed = await withFundingRecordLock(
    network,
    accountIdHash,
    async () => {
      const record: FundingRecord =
        (await loadFundingRecord(network, accountIdHash)) ?? {};

      if (record.funded === funded) return false;

      record.funded = funded;
      await saveFundingRecord(network, accountIdHash, record);
      return true;
    },
  );

  if (changed) {
    syncFundedAccountCount();
  }
};

const logFundingError = (error: unknown) => {
  logger.warn(
    DEBUG_CONFIG.LOG_PREFIX,
    "Failed to update an account funding record",
    { error },
  );
};

/**
 * Reports a result of the active-account fetch (`fetchAccountBalances`).
 *
 * Uses the same balances, prices and hidden tokens as the Home header total.
 * Never throws: telemetry must not break the balance fetch.
 */
export const reportActiveAccountBalances = async ({
  publicKey,
  network,
  isFunded,
  pricedBalances,
  hiddenTokenIds,
  pricesOk,
}: {
  publicKey: string;
  network: NETWORKS;
  isFunded: boolean | null | undefined;
  pricedBalances: PricedBalanceMap;
  hiddenTokenIds: string[];
  pricesOk: boolean;
}): Promise<void> => {
  try {
    if (network !== NETWORKS.PUBLIC) return;

    const nativeBalance = Object.entries(pricedBalances).find(([id]) =>
      isNativeAssetId(id),
    )?.[1];

    const funded = getFundedState({
      isFunded,
      hasBalanceError: false,
      hasPriceError: !pricesOk,
      hasUnpricedXlm:
        !!nativeBalance &&
        getBalanceInWholeUnits(nativeBalance).isGreaterThan(0) &&
        !nativeBalance.currentPrice,
      totalUsd: sumVisibleFiatTotals(pricedBalances, hiddenTokenIds).total,
    });

    if (funded === null) return;

    await applyActiveAccountFundedState({ publicKey, network, funded });
  } catch (error) {
    logFundingError(error);
  }
};

/**
 * Reports one account result of the all-accounts fetch
 * (`fetchAccountsFiatTotals`).
 *
 * @param balances - The balances without hidden tokens, or null when the
 *   fetch for this account failed
 * @param isFunded - The raw backend flag, not `isFunded ?? false`
 * @param pricesOk - False when the price fetch for the batch failed
 * @param totalUsd - The total that the fetch cycle already computed
 */
export const reportListAccountBalances = async ({
  publicKey,
  network,
  balances,
  isFunded,
  prices,
  pricesOk,
  totalUsd,
}: {
  publicKey: string;
  network: NETWORKS;
  balances: BalanceMap | null;
  isFunded: boolean | null | undefined;
  prices: TokenPricesMap;
  pricesOk: boolean;
  totalUsd: BigNumber;
}): Promise<void> => {
  try {
    if (network !== NETWORKS.PUBLIC) return;

    const nativeBalance = balances
      ? Object.values(balances).find((balance) => isNativeBalance(balance))
      : undefined;

    const funded = getFundedState({
      isFunded,
      hasBalanceError: balances === null,
      hasPriceError: !pricesOk,
      hasUnpricedXlm:
        !!nativeBalance &&
        getBalanceInWholeUnits(nativeBalance).isGreaterThan(0) &&
        !prices[getTokenIdentifier(nativeBalance)]?.currentPrice,
      totalUsd,
    });

    if (funded === null) return;

    await applyListAccountFundedState({ publicKey, network, funded });
  } catch (error) {
    logFundingError(error);
  }
};
