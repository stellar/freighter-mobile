import { BigNumber } from "bignumber.js";
import { DEFAULT_DEBOUNCE_DELAY, NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken, PricedBalance } from "config/types";
import { useSwapStore } from "ducks/swap";
import useDebounce from "hooks/useDebounce";
import { useEffect } from "react";

type BalanceItem = PricedBalance & {
  id: string;
  tokenType: TokenTypeWithCustomToken;
};

interface UseSwapPathFindingParams {
  sourceBalance: BalanceItem | undefined;
  destinationBalance: BalanceItem | undefined;
  sourceAmount: string;
  swapSlippage: number;
  network: NETWORKS;
  publicKey: string | undefined;
  amountError: string | null;
}

export const useSwapPathFinding = ({
  sourceBalance,
  destinationBalance,
  sourceAmount,
  swapSlippage,
  network,
  publicKey,
  amountError,
}: UseSwapPathFindingParams) => {
  const { findSwapPath, clearPath } = useSwapStore();

  const sourceAmountBN = new BigNumber(sourceAmount);

  const debouncedFindSwapPath = useDebounce(() => {
    if (
      sourceBalance &&
      destinationBalance &&
      sourceAmount &&
      sourceAmountBN.isGreaterThan(0) &&
      !amountError &&
      publicKey
    ) {
      findSwapPath({
        sourceBalance,
        destinationBalance,
        sourceAmount: sourceAmountBN.toString(),
        slippage: swapSlippage,
        network,
        publicKey,
      });
    } else {
      clearPath();
    }
  }, DEFAULT_DEBOUNCE_DELAY);

  useEffect(() => {
    debouncedFindSwapPath();
  }, [
    sourceBalance,
    destinationBalance,
    sourceAmount,
    swapSlippage,
    network,
    publicKey,
    amountError,
    debouncedFindSwapPath,
  ]);
};
