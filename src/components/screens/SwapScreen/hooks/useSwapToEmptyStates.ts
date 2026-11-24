import { FormattedSearchTokenRecord, HookStatus } from "config/types";

/**
 * Derives the empty-state booleans for the swap-to search. Mutually
 * exclusive by construction:
 *
 *   isSearching    — debounced search is mid-fetch (takes precedence)
 *   showNoResults  — term has no results
 */
export const useSwapToEmptyStates = ({
  searchTerm,
  status,
  heldSearchMatches,
  verifiedSearchMatches,
  unverifiedSearchMatches,
}: {
  searchTerm: string;
  status: HookStatus;
  heldSearchMatches: FormattedSearchTokenRecord[];
  verifiedSearchMatches: FormattedSearchTokenRecord[];
  unverifiedSearchMatches: FormattedSearchTokenRecord[];
}): {
  isSearching: boolean;
  showNoResults: boolean;
} => {
  const totalSearchResults =
    heldSearchMatches.length +
    verifiedSearchMatches.length +
    unverifiedSearchMatches.length;

  const isSearching =
    searchTerm.length > 0 &&
    status === HookStatus.LOADING &&
    totalSearchResults === 0;

  const showNoResults =
    !isSearching && searchTerm.length > 0 && totalSearchResults === 0;

  return { isSearching, showNoResults };
};
