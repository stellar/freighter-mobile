import { SWAP_SELECTION_TYPES } from "config/constants";
import { FormattedSearchTokenRecord, PricedBalance } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { useMemo } from "react";

/**
 * Section.kind drives both the header and the row variant for that
 * section — keeping title resolution (singular / plural) decoupled from
 * row logic so renderItem doesn't need to match against translated
 * strings.
 */
export type SwapToSectionKind = "held" | "popular" | "verified" | "unverified";

export type SwapToSection = {
  title: string;
  kind: SwapToSectionKind;
  data: Array<(PricedBalance & { id: string }) | FormattedSearchTokenRecord>;
};

/**
 * Builds SwapToScreen's SectionList data:
 *
 *   - **Idle** (no searchTerm): "Your tokens" (when the user holds any) +
 *     "Popular tokens" (destination mode only — the source picker is
 *     holdsOnly so popular non-held tokens can't be sources).
 *   - **Active search**: up to three sections ("Your tokens" / "Verified"
 *     / "Unverified") — each omitted when its bucket is empty.
 *
 * The opposite-side token is NOT excluded here — picking it triggers the
 * selection-swap rule: the opposite side clears so the user can pick a
 * different token there.
 */
export const useSwapToSections = ({
  searchTerm,
  heldSearchMatches,
  verifiedSearchMatches,
  unverifiedSearchMatches,
  yourTokens,
  popularTokens,
  selectionType,
}: {
  searchTerm: string;
  heldSearchMatches: FormattedSearchTokenRecord[];
  verifiedSearchMatches: FormattedSearchTokenRecord[];
  unverifiedSearchMatches: FormattedSearchTokenRecord[];
  yourTokens: Array<PricedBalance & { id: string }>;
  popularTokens: FormattedSearchTokenRecord[];
  selectionType: SWAP_SELECTION_TYPES;
}): SwapToSection[] => {
  const { t } = useAppTranslation();

  return useMemo(() => {
    const out: SwapToSection[] = [];

    const heldTitle = (count: number) =>
      count === 1
        ? t("swapScreen.yourTokenSection")
        : t("swapScreen.yourTokensSection");

    if (searchTerm) {
      if (heldSearchMatches.length > 0) {
        out.push({
          title: heldTitle(heldSearchMatches.length),
          kind: "held",
          data: heldSearchMatches,
        });
      }
      if (verifiedSearchMatches.length > 0) {
        out.push({
          title: t("swapScreen.verifiedSection"),
          kind: "verified",
          data: verifiedSearchMatches,
        });
      }
      if (unverifiedSearchMatches.length > 0) {
        out.push({
          title: t("swapScreen.unverifiedSection"),
          kind: "unverified",
          data: unverifiedSearchMatches,
        });
      }
      return out;
    }

    if (yourTokens.length > 0) {
      out.push({
        title: heldTitle(yourTokens.length),
        kind: "held",
        data: yourTokens,
      });
    }

    if (
      popularTokens.length > 0 &&
      selectionType === SWAP_SELECTION_TYPES.DESTINATION
    ) {
      out.push({
        title: t("swapScreen.popularTokensSection"),
        kind: "popular",
        data: popularTokens,
      });
    }

    return out;
  }, [
    searchTerm,
    heldSearchMatches,
    verifiedSearchMatches,
    unverifiedSearchMatches,
    yourTokens,
    popularTokens,
    selectionType,
    t,
  ]);
};
