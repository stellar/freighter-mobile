import { selectSwapRoute } from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { PricedBalance } from "config/types";
import { swapPairKey, swapQuoteKey, useSwapStore } from "ducks/swap";
import { computeTotalFeeXlm } from "helpers/soroban";
import { useMemo } from "react";

/**
 * The quote state and network fees of a swap, shared by main Swap and the
 * swap inside Earn so both size and check amounts the same way.
 *
 * - `currentQuoteKey`: the quote request for the current inputs, or null when
 *   they can't be quoted. The store keeps the last quote until the debounced
 *   re-quote replaces it, so a quote counts only while it answers these
 *   inputs (`isQuoteCurrent`).
 * - `totalFee`: the inclusion fee plus, on a Soroban route, the current
 *   quote's resource fee, in XLM.
 * - `spendableFee`: the fee to size the spendable amount with. Max changes
 *   the amount, so the quote it lands on is a new one: without a current
 *   quote, it uses the pair's last resource fee, so the first tap stays
 *   within the fee that quote will carry.
 */
export const useSwapQuoteFees = ({
  sourceBalance,
  destinationBalance,
  sourceAmount,
  network,
  publicKey,
  swapFee,
}: {
  sourceBalance: PricedBalance | undefined;
  destinationBalance: PricedBalance | undefined;
  sourceAmount: string;
  network: NETWORKS;
  publicKey: string | undefined;
  swapFee: string;
}) => {
  const { pathResult, swapQuotes, lastResourceFee } = useSwapStore();

  const currentQuoteKey = useMemo(
    () =>
      sourceBalance && destinationBalance && publicKey
        ? swapQuoteKey({
            sourceBalance,
            destinationBalance,
            sourceAmount,
            network,
            publicKey,
          })
        : null,
    [sourceBalance, destinationBalance, sourceAmount, network, publicKey],
  );

  const isQuoteCurrent =
    !!pathResult && pathResult.quoteKey === currentQuoteKey;
  const resourceFee =
    isQuoteCurrent && swapQuotes
      ? selectSwapRoute(swapQuotes)?.resourceFee
      : undefined;
  const totalFee = computeTotalFeeXlm(swapFee, resourceFee ?? null, swapFee);

  const pairKey =
    sourceBalance && destinationBalance && publicKey
      ? swapPairKey({
          sourceBalance,
          destinationBalance,
          network,
          publicKey,
        })
      : null;
  const lastPairFee =
    pairKey && lastResourceFee?.pairKey === pairKey
      ? lastResourceFee.fee
      : null;
  const spendableFee = computeTotalFeeXlm(
    swapFee,
    (isQuoteCurrent ? resourceFee : lastPairFee) ?? null,
    swapFee,
  );

  return {
    currentQuoteKey,
    isQuoteCurrent,
    resourceFee,
    totalFee,
    spendableFee,
  };
};
