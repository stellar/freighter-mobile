import { TransactionBuilder } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { SubmitTransactionOutcome } from "ducks/transactionBuilder";
import { ConfirmationPriceSnapshot } from "helpers/confirmationPriceSnapshot";
import {
  findPathPaymentStrictSendIndex,
  getSettledPathPaymentStrictSendAmount,
} from "helpers/transactionResult";
import {
  AssetIdentity,
  LegUsdStatus,
  computeExecutionSlippagePct,
  computeUsdSlippagePct,
  deriveLegUsd,
} from "helpers/usdVolume";
import { analytics } from "services/analytics";

/** Actual confirmed output; enrichment failures never fail a successful swap. */
const readSettledDestinationAmount = ({
  outcome,
  signedXDR,
  network,
}: {
  outcome: SubmitTransactionOutcome;
  signedXDR: string;
  network: NETWORKS;
  destination: PricedBalance;
  publicKey: string;
}): BigNumber | null => {
  try {
    const { networkPassphrase } = mapNetworkToNetworkDetails(network);
    const submittedTx = TransactionBuilder.fromXdr(
      signedXDR,
      networkPassphrase,
    );
    const opIndex = findPathPaymentStrictSendIndex(submittedTx);

    if (opIndex >= 0) {
      return outcome.resultXdr
        ? getSettledPathPaymentStrictSendAmount(outcome.resultXdr, opIndex)
        : null;
    }

    return null;
  } catch (error) {
    logger.error(
      "SwapSettlement",
      "Failed to read the settled destination amount",
      error,
    );

    return null;
  }
};

/**
 * Everything `reportSettledSwap` needs, captured before the swap screen can go
 * away: the report outlives the hook that started it.
 */
interface SettledSwapReport {
  outcome: SubmitTransactionOutcome;
  signedXDR: string;
  network: NETWORKS;
  destination: PricedBalance;
  publicKey: string;
  snapshot: ConfirmationPriceSnapshot;
  sourceAmount: string;
  sourceCanonicalId: string;
  destCanonicalId: string;
  sourceIdentity: AssetIdentity;
  destIdentity: AssetIdentity;
  sourceToken: string;
  destToken: string;
  /** The destination amount the signed swap quoted. */
  quotedDestinationAmount: string | undefined;
  allowedSlippage: string | undefined;
}

/**
 * Reads the settled destination amount and emits `swap.completed` with the
 * volume figures. Started without being awaited after a swap settled, so the
 * user-visible flow never waits for the read; it holds no hook or component
 * state and never throws.
 *
 * When Stellar Expert cannot supply the meta the event still fires, with
 * `to_amount_usd_status: "error"` and no `to_amount`.
 */
export const reportSettledSwap = (report: SettledSwapReport): void => {
  try {
    const {
      snapshot,
      sourceAmount,
      sourceCanonicalId,
      destCanonicalId,
      quotedDestinationAmount,
    } = report;
    const settledDestAmount = readSettledDestinationAmount(report);

    const sourceLeg = deriveLegUsd(
      sourceAmount,
      snapshot.pricesById?.[sourceCanonicalId]?.currentPrice,
    );
    const destLeg =
      settledDestAmount !== null
        ? deriveLegUsd(
            settledDestAmount,
            snapshot.pricesById?.[destCanonicalId]?.currentPrice,
          )
        : null;

    const executionSlippagePct =
      settledDestAmount !== null
        ? computeExecutionSlippagePct(
            quotedDestinationAmount,
            settledDestAmount,
          )
        : undefined;
    const usdSlippagePct =
      sourceLeg.status === LegUsdStatus.OK &&
      destLeg?.status === LegUsdStatus.OK &&
      sourceLeg.value !== 0
        ? computeUsdSlippagePct(sourceLeg.unrounded, destLeg.unrounded)
        : undefined;

    analytics.trackSwapSuccess({
      sourceToken: report.sourceToken,
      destToken: report.destToken,
      sourceAmount,
      destAmount: quotedDestinationAmount,
      allowedSlippage: report.allowedSlippage,
      isSwap: true,
      volume: {
        identity: report.sourceIdentity,
        toIdentity: report.destIdentity,
        amount: new BigNumber(sourceAmount || 0).toNumber(),
        sourceLeg,
        priceSource: snapshot.source,
        priceFreshness: snapshot.freshness,
        ...(quotedDestinationAmount
          ? {
              toAmountQuoted: new BigNumber(quotedDestinationAmount).toNumber(),
            }
          : {}),
        ...(settledDestAmount !== null
          ? { toAmount: settledDestAmount.toNumber() }
          : {}),
        toAmountUsdStatus: destLeg?.status ?? LegUsdStatus.ERROR,
        ...(destLeg?.status === LegUsdStatus.OK
          ? { toAmountUsd: destLeg.value, toAmountUsdRate: destLeg.rate }
          : {}),
        ...(usdSlippagePct !== undefined ? { usdSlippagePct } : {}),
        ...(executionSlippagePct !== undefined ? { executionSlippagePct } : {}),
      },
    });
  } catch (error) {
    logger.error("SwapSettlement", "Failed to report the settled swap", error);
  }
};
