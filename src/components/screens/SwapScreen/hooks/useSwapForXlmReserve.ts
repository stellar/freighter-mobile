import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import {
  DEFAULT_DECIMALS,
  isNativeAssetId,
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import { logger } from "config/logger";
import { TokenTypeWithCustomToken } from "config/types";
import { calculateSpendableAmount } from "helpers/balances";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useCallback, useRef } from "react";

interface UseSwapForXlmReserveParams {
  sourceBalance: HeldBalanceItem | undefined;
  bestNonXlmClassicBalance: HeldBalanceItem | undefined;
  network: NETWORKS;
  subentryCount: number;
  swapFee: string;
  setSourceToken: (id: string, symbol: string) => void;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
  setTokenAmount: (amount: string) => void;
}

/**
 * Owns the "Swap for 0.5 XLM" affordance behind the XlmReserveBottomSheet —
 * the sheet shown when adding a trustline would leave the account below the
 * XLM base reserve.
 *
 * Two sell-token modes:
 *   1. Current source is a non-XLM classic token → reuse it as the sell side,
 *      only flip the receive side to XLM. The pre-filled amount survives
 *      because the source token didn't change.
 *   2. Current source is XLM (or unset) → fall back to the user's best
 *      non-XLM classic balance. The amount resets per the converter rule.
 *
 * The CTA is hidden (`canOfferSwapToXlm === false`) when neither mode applies
 * (e.g. the user holds only XLM with XLM as source).
 */
export const useSwapForXlmReserve = ({
  sourceBalance,
  bestNonXlmClassicBalance,
  network,
  subentryCount,
  swapFee,
  setSourceToken,
  setDestinationToken,
  setTokenAmount,
}: UseSwapForXlmReserveParams) => {
  const xlmReserveBottomSheetRef = useRef<BottomSheetModal>(null);

  const isCurrentSourceNonXlmClassic =
    !!sourceBalance &&
    !isNativeAssetId(sourceBalance.id) &&
    (sourceBalance.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM4 ||
      sourceBalance.tokenType === TokenTypeWithCustomToken.CREDIT_ALPHANUM12);
  const canOfferSwapToXlm =
    isCurrentSourceNonXlmClassic || !!bestNonXlmClassicBalance;

  // Picks the sell token, sets XLM as the Receive token, and asks Horizon's
  // strictReceivePaths how much of the sell token it would take to receive at
  // least 0.5 XLM.
  //
  // Sell-token resolution:
  //   - Non-XLM classic source → reuse it. The amount survives because the
  //     source token didn't change (the converter's reset-on-selected-token-
  //     change rule is keyed on the token code, see useTokenFiatConverter).
  //   - Otherwise (source is XLM or unset) → fall back to the best non-XLM
  //     classic balance. The pre-filled amount gets wiped by the converter's
  //     reset on the next render — acceptable since any prior amount was
  //     denominated in the now-replaced source.
  const handleSwapForXlmFromSheet = useCallback(async () => {
    const sellBalance = isCurrentSourceNonXlmClassic
      ? sourceBalance
      : bestNonXlmClassicBalance;
    if (!sellBalance) return;
    const sellTokenCode = sellBalance.tokenCode;
    const sellIssuer =
      "token" in sellBalance &&
      sellBalance.token &&
      "issuer" in sellBalance.token
        ? sellBalance.token.issuer?.key
        : undefined;
    if (!sellTokenCode || !sellIssuer) return;

    let receivedSourceAmount: string | null = null;
    try {
      const networkDetails = mapNetworkToNetworkDetails(network);
      const server = new Horizon.Server(networkDetails.networkUrl);
      const sellAsset = new Asset(sellTokenCode, sellIssuer);
      const result = await server
        .strictReceivePaths([sellAsset], Asset.native(), "0.5")
        .limit(1)
        .call();
      receivedSourceAmount = result.records[0]?.source_amount ?? null;
    } catch (error) {
      // No path / network error — fall back to setting source+dest without
      // a pre-filled amount so the user can still adjust manually. Expected
      // and handled, so warn (not error → no red LogBox / Sentry issue).
      logger.warn(
        "useSwapForXlmReserve.handleSwapForXlmFromSheet",
        "strictReceivePaths failed",
        error,
      );
    }

    setDestinationToken({
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      decimals: DEFAULT_DECIMALS,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    });

    if (!isCurrentSourceNonXlmClassic) {
      // Fallback: swap the sell side to the best non-XLM classic balance.
      // setSourceToken resets the store amount in the same batch (see the
      // swap store), so the prior XLM amount never trips the insufficient-
      // balance check against the new sell balance. Reset the converter too.
      setSourceToken(sellBalance.id, sellTokenCode);
      setTokenAmount("0");
    } else if (receivedSourceAmount) {
      // Source reused (no token change → no converter reset): pre-fill the
      // amount needed to receive 0.5 XLM. That amount can exceed what's
      // actually spendable of the sell token, so cap it to the sell
      // token's spendable (same calc the error check uses) — the user may
      // get less than 0.5 XLM and adjust, but never lands on an error.
      const sellSpendable = calculateSpendableAmount({
        balance: sellBalance,
        subentryCount,
        transactionFee: swapFee,
      });
      const cappedAmount = BigNumber.minimum(
        new BigNumber(receivedSourceAmount),
        sellSpendable,
      );
      setTokenAmount(cappedAmount.toFixed(DEFAULT_DECIMALS));
    }

    xlmReserveBottomSheetRef.current?.dismiss();
  }, [
    isCurrentSourceNonXlmClassic,
    sourceBalance,
    bestNonXlmClassicBalance,
    network,
    subentryCount,
    swapFee,
    setSourceToken,
    setDestinationToken,
    setTokenAmount,
  ]);

  return {
    xlmReserveBottomSheetRef,
    canOfferSwapToXlm,
    handleSwapForXlmFromSheet,
  };
};
