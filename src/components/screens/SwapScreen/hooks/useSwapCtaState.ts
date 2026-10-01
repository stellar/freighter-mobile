import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { PricedBalance } from "config/types";
import { SwapInputSide, SwapPathResult } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";

/** Select missing token, enter amount, check funds, await quote, then review. */
export type SwapCtaState =
  | { kind: "select"; missingSide: "source" | "destination" }
  | { kind: "enter" }
  | { kind: "insufficient" }
  | { kind: "loading" }
  | { kind: "review" };

/**
 * Derives the swap CTA state + i18n label + disabled flag from the screen's
 * input + path-finding inputs. Pure useMemo chain — no effects, refs, or
 * navigation. The discriminated union escapes here as `SwapCtaState` for
 * consumers that need to switch on kind/missingSide.
 *
 * Disabled-flag rationale: 'insufficient' is the dedicated CTA branch, but
 * amountError / pathError can fire from other paths (XLM-for-fees gate,
 * upstream path-finding failure) and should also disable the button — so
 * the gate is the union of those three conditions.
 */
export const useSwapCtaState = ({
  sourceBalance,
  destinationTokenDescriptor,
  sourceAmount,
  inputSide,
  destinationInputAmount,
  spendableAmount,
  isLoadingPath,
  isBuilding,
  pathResult,
  pathError,
  amountError,
}: {
  sourceBalance: PricedBalance | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  sourceAmount: string;
  inputSide: SwapInputSide;
  destinationInputAmount: string;
  spendableAmount: BigNumber | null;
  isLoadingPath: boolean;
  isBuilding: boolean;
  pathResult: SwapPathResult | null;
  pathError: string | null;
  amountError: string | null;
}): { ctaState: SwapCtaState; ctaLabel: string; isCtaDisabled: boolean } => {
  const { t } = useAppTranslation();

  const ctaState: SwapCtaState = useMemo(() => {
    // "Select a token" fires whenever EITHER side is empty — picking the
    // missing side first is what the user expects. Source-first ordering
    // when both are empty so we resolve the upstream input before the
    // downstream destination.
    if (!sourceBalance) return { kind: "select", missingSide: "source" };
    if (!destinationTokenDescriptor) {
      return { kind: "select", missingSide: "destination" };
    }

    // When the user types in the receive card the source amount is derived
    // from the quote, so the typed amount is the receive amount and the source
    // amount is stale until the quote returns.
    const isExactOut = inputSide === SwapInputSide.DESTINATION;
    const typedBN = new BigNumber(
      (isExactOut ? destinationInputAmount : sourceAmount) || "0",
    );
    if (typedBN.isZero() || typedBN.isNaN()) return { kind: "enter" };

    if (isExactOut && (isLoadingPath || isBuilding)) return { kind: "loading" };

    const sourceBN = new BigNumber(sourceAmount || "0");
    if (spendableAmount && sourceBN.gt(spendableAmount)) {
      return { kind: "insufficient" };
    }

    if (isLoadingPath || isBuilding) return { kind: "loading" };

    if (pathResult && !pathError) return { kind: "review" };

    // Path-finding finished without a result (or threw) — keep the user on
    // the amount step. The persistent toast (set up by the screen) already
    // surfaces pathError when present.
    return { kind: "enter" };
  }, [
    sourceBalance,
    destinationTokenDescriptor,
    sourceAmount,
    inputSide,
    destinationInputAmount,
    spendableAmount,
    isLoadingPath,
    isBuilding,
    pathResult,
    pathError,
  ]);

  const ctaLabel = useMemo(() => {
    switch (ctaState.kind) {
      case "select":
        return t("swapScreen.cta.select");
      case "enter":
        return t("swapScreen.cta.enterAmount");
      case "insufficient":
        return t("swapScreen.cta.insufficientBalance");
      case "loading":
        return t("swapScreen.cta.review");
      case "review":
      default:
        return t("swapScreen.cta.review");
    }
  }, [ctaState, t]);

  const isCtaDisabled =
    ctaState.kind === "insufficient" || !!amountError || !!pathError;

  return { ctaState, ctaLabel, isCtaDisabled };
};
