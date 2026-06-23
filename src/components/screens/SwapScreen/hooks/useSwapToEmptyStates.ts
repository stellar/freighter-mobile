import { FormattedSearchTokenRecord, HookStatus } from "config/types";
import { isContractId } from "helpers/soroban";

/**
 * Derives the empty-state booleans for the swap-to search. Mutually
 * exclusive by construction:
 *
 *   isSearching       — debounced search is mid-fetch (takes precedence)
 *   showSorobanEmpty  — term has results filtered out as Soroban / contract id
 *   showNoResults     — term has no results, NOT a Soroban case
 */
export const useSwapToEmptyStates = ({
  searchTerm,
  status,
  heldSearchMatches,
  verifiedSearchMatches,
  unverifiedSearchMatches,
  hadSorobanMatches,
}: {
  searchTerm: string;
  status: HookStatus;
  heldSearchMatches: FormattedSearchTokenRecord[];
  verifiedSearchMatches: FormattedSearchTokenRecord[];
  unverifiedSearchMatches: FormattedSearchTokenRecord[];
  hadSorobanMatches: boolean;
}): {
  isSearching: boolean;
  showSorobanEmpty: boolean;
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

  const showSorobanEmpty =
    !isSearching &&
    searchTerm.length > 0 &&
    totalSearchResults === 0 &&
    (hadSorobanMatches || isContractId(searchTerm));

  const showNoResults =
    !isSearching &&
    searchTerm.length > 0 &&
    totalSearchResults === 0 &&
    !showSorobanEmpty;

  return { isSearching, showSorobanEmpty, showNoResults };
};
