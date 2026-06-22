import { DEFAULT_DEBOUNCE_DELAY, NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken, PricedBalance } from "config/types";
import { useSwapStore } from "ducks/swap";
import useDebounce from "hooks/useDebounce";
import { useEffect } from "react";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

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
  swapSlippage: number;
  network: NETWORKS;
  publicKey: string | undefined;
  amountError: string | null;
}

export const useSwapPathFinding = ({
  sourceBalance,
  destinationTokenForPath,
  sourceAmount,
  swapSlippage,
  network,
  publicKey,
  amountError,
}: UseSwapPathFindingParams) => {
  const { findSwapPath, clearPath } = useSwapStore();

  const debouncedFindSwapPath = useDebounce(() => {
    if (
      sourceBalance &&
      destinationTokenForPath &&
      sourceAmount &&
      Number(sourceAmount) > 0 &&
      !amountError &&
      publicKey
    ) {
      findSwapPath({
        sourceBalance,
        destinationBalance: destinationTokenForPath,
        sourceAmount,
        slippage: swapSlippage,
        network,
        publicKey,
      });
    } else {
      clearPath();
    }
  }, DEFAULT_DEBOUNCE_DELAY);

  // Key on the stable `id` (not the object ref) so the 30s balance-polling
  // re-renders don't re-trigger path-finding. The quote stays frozen until
  // the token or amount actually changes. `debouncedFindSwapPath` is a stable
  // wrapper that reads the latest objects at call time.
  useEffect(() => {
    debouncedFindSwapPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceBalance?.id,
    destinationTokenForPath?.id,
    sourceAmount,
    swapSlippage,
    network,
    publicKey,
    amountError,
    debouncedFindSwapPath,
  ]);
};
