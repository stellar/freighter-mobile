import { FormattedSearchTokenRecord, HookStatus } from "config/types";
import { isContractId } from "helpers/soroban";

/**
 * Derives the four interlocking booleans that gate which empty-state
 * branch SwapToScreen renders when the user's debounced search returns
 * empty. The booleans are mutually-exclusive by construction:
 *
 *   isSearching       — debounced search is mid-fetch (takes precedence)
 *   showSorobanEmpty  — term has results filtered out as Soroban / contract id
 *   showNoResults     — term has no results, NOT a Soroban case
 *
 * `totalSearchResults` is exposed too so the caller can avoid re-summing
 * the three bucket lengths.
 *
 * Plain derivation — no useMemo needed (the inputs are primitive
 * lengths + a string + an enum + an array literal that re-renders the
 * screen anyway).
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
  totalSearchResults: number;
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

  return { totalSearchResults, isSearching, showSorobanEmpty, showNoResults };
};
