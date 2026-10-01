import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken, PricedBalance } from "config/types";
import { SwapInputSide, useSwapStore } from "ducks/swap";
import useDebounce from "hooks/useDebounce";
import { useEffect } from "react";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

const SWAP_QUOTE_DEBOUNCE_MS = 200;

/**
 * Debounced path-finder for the swap flow.
 *
 * `destinationTokenForPath` is either the user's real held PricedBalance
 * for the destination, OR a `descriptorAsPathBalance(descriptor)` shim
 * for non-held destinations. `findSwapPath` only reads the `token` shape
 * off this argument (code/issuer/type), so the shim is structurally
 * sufficient. Don't treat the value as a real holding downstream.
 */
interface UseSwapPathFindingParams {
  sourceBalance: BalanceItem | undefined;
  destinationTokenForPath: BalanceItem | undefined;
  sourceAmount: string;
  /** Which card the user typed in; the quote is asked for that amount. */
  inputSide: SwapInputSide;
  /** The amount typed in the receive card; only read when `inputSide` is `SwapInputSide.DESTINATION`. */
  destinationInputAmount: string;
  swapSlippage: number;
  /** How long, in seconds, an aggregator transaction stays valid. */
  swapTimeout: number;
  network: NETWORKS;
  publicKey: string | undefined;
  amountError: string | null;
}

export const useSwapPathFinding = ({
  sourceBalance,
  destinationTokenForPath,
  sourceAmount,
  inputSide,
  destinationInputAmount,
  swapSlippage,
  swapTimeout,
  network,
  publicKey,
  amountError,
}: UseSwapPathFindingParams) => {
  const { findSwapPath, clearPath } = useSwapStore();

  const isExactOut = inputSide === SwapInputSide.DESTINATION;
  // The typed amount is what the quote is asked for; the other card shows what
  // the backend derives from it, so it must not re-trigger the lookup.
  const typedAmount = isExactOut ? destinationInputAmount : sourceAmount;
  const canFindPath = Boolean(
    sourceBalance &&
      destinationTokenForPath &&
      typedAmount &&
      Number(typedAmount) > 0 &&
      !amountError &&
      publicKey,
  );

  const debouncedFindSwapPath = useDebounce(() => {
    if (sourceBalance && destinationTokenForPath && canFindPath && publicKey) {
      findSwapPath({
        sourceBalance,
        destinationBalance: destinationTokenForPath,
        ...(isExactOut
          ? { destinationAmount: typedAmount }
          : { sourceAmount: typedAmount }),
        slippage: swapSlippage,
        timeoutSeconds: swapTimeout,
        network,
        publicKey,
      });
    }
  }, SWAP_QUOTE_DEBOUNCE_MS);

  // Key on the stable `id` (not the object ref) so the 30s balance-polling
  // re-renders don't re-trigger path-finding. The quote stays frozen until
  // the token or amount actually changes. `debouncedFindSwapPath` is a stable
  // wrapper that reads the latest objects at call time.
  useEffect(() => {
    clearPath(canFindPath);
    if (canFindPath) debouncedFindSwapPath();
    else debouncedFindSwapPath.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceBalance?.id,
    destinationTokenForPath?.id,
    typedAmount,
    isExactOut,
    swapSlippage,
    swapTimeout,
    network,
    publicKey,
    amountError,
    canFindPath,
    clearPath,
    debouncedFindSwapPath,
  ]);

  useEffect(() => () => clearPath(), [clearPath]);
};
