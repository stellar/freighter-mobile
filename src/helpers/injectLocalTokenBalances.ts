import { Networks } from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { BalanceMap, TokenDetailsResponse } from "config/types";
import { isSacContractForAsset } from "helpers/balances";
import { MappedAccountBalances } from "helpers/mapAccountBalancesV2";

interface InjectLocalTokenBalancesArgs {
  accountBalances: MappedAccountBalances;
  /** Raw `token_id` of every balance the backend returned. */
  backendTokenIds: Set<string>;
  /** Contract IDs the user saved locally, from `retrieveCustomTokens`. */
  localTokenIds: string[] | undefined;
  networkPassphrase: Networks;
  fetchTokenDetails: (
    contractId: string,
  ) => Promise<TokenDetailsResponse | null | undefined>;
}

/**
 * Adds a balance entry for every locally saved custom-token contract ID the
 * backend did not return, so a token the user explicitly added still renders
 * when they hold no balance for it (the indexer only knows about tokens an
 * account has a balance for, so a zero-balance SEP-41 token never comes back).
 *
 * The v1 balances endpoint did this server-side: the client sent its local
 * contract IDs as `contract_ids` hints and the backend resolved each one over
 * RPC. The v2 endpoint takes account addresses only, so the merge moves here.
 *
 * Entries are keyed `<symbol>:<contractId>` with a `token.issuer.key` of the
 * contract ID — the same shape the v1 path produces, and what
 * `formatTokenIdentifier` and `getTokenType` read. That is what makes the token
 * show as already added in the Add Token search and resolve as a custom token
 * everywhere else.
 *
 * `localOnlyTokenIds` on the result names the contracts that were injected.
 * Only those may be removed from the balances view; a token the backend
 * returns can be hidden but not removed.
 */
export const injectLocalTokenBalances = async ({
  accountBalances,
  backendTokenIds,
  localTokenIds,
  networkPassphrase,
  fetchTokenDetails,
}: InjectLocalTokenBalancesArgs): Promise<MappedAccountBalances> => {
  // Defaulted because retrieveCustomTokens swallows storage errors and returns
  // nothing, and a custom token must never take the whole balances load down.
  const candidates = (localTokenIds || []).filter(
    (id) => !backendTokenIds.has(id),
  );

  if (!candidates.length) {
    return { ...accountBalances, localOnlyTokenIds: [] };
  }

  const balances = accountBalances.balances || {};
  const details = await Promise.all(
    candidates.map(async (contractId) => ({
      contractId,
      tokenDetails: await fetchTokenDetails(contractId),
    })),
  );

  const injected = {} as Record<string, unknown>;
  const localOnlyTokenIds = [] as string[];

  details.forEach(({ contractId, tokenDetails }) => {
    if (!tokenDetails) {
      // The contract could not be resolved (unreachable backend, not a token).
      // Skip it for this fetch rather than failing the whole balance load.
      return;
    }

    // A SAC's `name` is the canonical `CODE:ISSUER` of the classic asset it
    // wraps, which is also how the backend keys that asset's CLASSIC and SAC
    // balances. Dedupe on that key too: a classic `token_id` is the asset
    // string, not the contract ID, so `backendTokenIds` alone does not catch a
    // locally added SAC that is already on screen as a trustline.
    if (
      isSacContractForAsset(tokenDetails.name, contractId, networkPassphrase) &&
      balances[tokenDetails.name]
    ) {
      return;
    }

    // Guard against a degenerate `:CONTRACT_ID` key, which downstream code
    // reads as an asset with no issuer.
    const symbol = tokenDetails.symbol || tokenDetails.name || contractId;
    const key = `${symbol}:${contractId}`;

    if (balances[key] || injected[key]) {
      return;
    }

    const total = new BigNumber(tokenDetails.balance || 0);
    injected[key] = {
      token: { code: symbol, issuer: { key: contractId } },
      contractId,
      total,
      available: total,
      symbol,
      name: tokenDetails.name,
      decimals: tokenDetails.decimals,
      // Stamped by addBlockaidScanResults, which runs after this merge.
      blockaidData: undefined,
    };
    localOnlyTokenIds.push(contractId);
  });

  return {
    ...accountBalances,
    balances: { ...balances, ...injected } as unknown as BalanceMap,
    localOnlyTokenIds,
  };
};
