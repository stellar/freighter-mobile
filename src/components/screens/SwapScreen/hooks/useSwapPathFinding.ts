import { NETWORKS } from "config/constants";
import { AssetTypeWithCustomToken, PricedBalance } from "config/types";
import { useSwapStore } from "ducks/swap";
import useDebounce from "hooks/useDebounce";
import { useCallback, useEffect } from "react";

type BalanceItem = PricedBalance & {
  id: string;
  assetType: AssetTypeWithCustomToken;
};

interface UseSwapPathFindingParams {
  swapFromTokenBalance: BalanceItem | undefined;
  swapToTokenBalance: BalanceItem | undefined;
  swapAmount: string;
  swapSlippage: number;
  network: NETWORKS;
  publicKey: string | undefined;
  amountError: string | null;
}

export const useSwapPathFinding = ({
  swapFromTokenBalance,
  swapToTokenBalance,
  swapAmount,
  swapSlippage,
  network,
  publicKey,
  amountError,
}: UseSwapPathFindingParams) => {
  const { findSwapPath, clearPath } = useSwapStore();

  const findSwapPathDebounced = useCallback(() => {
    if (
      swapFromTokenBalance &&
      swapToTokenBalance &&
      swapAmount &&
      Number(swapAmount) > 0 &&
      !amountError &&
      publicKey
    ) {
      findSwapPath({
        fromBalance: swapFromTokenBalance,
        toBalance: swapToTokenBalance,
        amount: swapAmount,
        slippage: swapSlippage,
        network,
        publicKey,
      });
    } else {
      clearPath();
    }
  }, [
    swapFromTokenBalance,
    swapToTokenBalance,
    swapAmount,
    swapSlippage,
    network,
    publicKey,
    amountError,
    findSwapPath,
    clearPath,
  ]);

  const debouncedFindSwapPath = useDebounce(findSwapPathDebounced);

  useEffect(() => {
    debouncedFindSwapPath();
  }, [debouncedFindSwapPath]);
};
