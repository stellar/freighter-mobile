import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { PricedBalance } from "config/types";
import { SwapPathResult } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";

/**
 * CTA state-machine.
 *
 *   select       either side empty  ──► navigate to the missing picker
 *   enter        sides set, amount == 0  ──► focus the Sell input
 *   insufficient amount exceeds spendable  ──► disabled
 *   loading      path-finding in flight  ──► spinner
 *   review       path resolved, amount valid  ──► open Review sheet
 */
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

    const amountBN = new BigNumber(sourceAmount || "0");
    if (amountBN.isZero() || amountBN.isNaN()) return { kind: "enter" };

    if (spendableAmount && amountBN.gt(spendableAmount)) {
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
