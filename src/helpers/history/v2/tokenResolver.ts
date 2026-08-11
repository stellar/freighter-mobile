/**
 * Resolves the token contract addresses (C...) referenced by a page of v2
 * history state changes into display data, batched and cached.
 *
 * Resolution order per token id:
 *  1. the network's native SAC → XLM, 7 decimals
 *  2. the account's own balances (classic SACs derived via Asset.contractId)
 *  3. curated token lists — code/decimals/icon, no network call
 *  4. token details (getTokenDetails) — symbol/name/decimals
 *  5. fallback: truncated contract id, UNKNOWN decimals, no icon
 *
 * `decimals: null` means "we could not determine the scale". It is not a
 * synonym for 7: the v2 payload gives amounts as smallest-unit integers with no
 * decimals field, so scaling by a guessed 7 renders a SEP-41 token with 18
 * decimals 10^11 times too large. Callers must render no amount instead —
 * see mapBalanceChanges and classify's signedAmount.
 *
 * `publicKey` is required because the token-details endpoint validates it and
 * 400s on an empty string, which silently sent every token to the fallback.
 *
 * The mappers are synchronous — call buildTokenContext() once per page before
 * mapping, then hand the returned map to mapV2Transaction.
 */
import { Asset } from "@stellar/stellar-sdk";
import { DEFAULT_DECIMALS, NetworkDetails } from "config/constants";
import { BalanceMap } from "config/types";
import { ResolvedToken } from "helpers/history/v2/model";
import { getNativeContractDetails } from "helpers/soroban";
import { TokenListReponseItem } from "services/verified-token-lists/types";

export type TokenContext = Map<string, ResolvedToken>;

const truncateContractId = (contractId: string) =>
  `${contractId.slice(0, 4)}…${contractId.slice(-4)}`;

/** What a token id resolves to when nothing knows it: name it, don't scale it. */
const unresolvedToken = (contractId: string): ResolvedToken => ({
  code: truncateContractId(contractId),
  contractId,
  issuer: null,
  icon: null,
  decimals: null,
});

/**
 * Find a token id in the enabled curated lists. `contract` on a list entry is
 * best-effort (see TokenListReponseItem), and entries carry `decimals`, which is
 * why this reads the record directly instead of going through
 * getIconUrlFromTokensLists — that helper only returns an icon, and only for
 * records that have one.
 *
 * Divergence from the extension: it looped over an array of list responses
 * and then over each response's `assets`. Mobile's useVerifiedTokensStore
 * already flattens every configured list into one item array, so only the
 * inner loop survives here — there is no outer list-of-lists to walk.
 */
const findInTokenLists = (
  contractId: string,
  tokenListItems: TokenListReponseItem[],
): TokenListReponseItem | null => {
  // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's resolution algorithm; rewriting as array methods would obscure the early-return short-circuit on first match.
  for (const item of tokenListItems) {
    if (item.contract.toUpperCase() === contractId.toUpperCase()) {
      return item;
    }
  }
  return null;
};

/** Index the account's classic balances by their SAC contract address */
const indexBalancesByContractId = (
  balances: BalanceMap | undefined,
  networkPassphrase: string,
  getBalanceIconFn: (code: string, issuer: string | null) => string | null,
): TokenContext => {
  const byContract: TokenContext = new Map();
  if (!balances) {
    return byContract;
  }

  // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's resolution algorithm; the early `continue`s below are clearer than nesting this in array-method callbacks.
  for (const balance of Object.values(balances)) {
    const token = "token" in balance ? balance.token : null;
    if (!token || !("code" in token)) {
      // eslint-disable-next-line no-continue -- ported verbatim; see the loop's disable reason above.
      continue;
    }

    // Soroban tokens carry their contract id directly
    const directContractId =
      "contractId" in balance && typeof balance.contractId === "string"
        ? balance.contractId
        : null;

    const issuerKey =
      "issuer" in token && token.issuer && "key" in token.issuer
        ? token.issuer.key
        : null;

    let contractId = directContractId;
    if (!contractId && issuerKey) {
      try {
        contractId = new Asset(token.code, issuerKey).contractId(
          networkPassphrase,
        );
      } catch {
        contractId = null;
      }
    }
    if (!contractId) {
      // eslint-disable-next-line no-continue -- ported verbatim; see the loop's disable reason above.
      continue;
    }

    // Prefer a real icon over the lettered fallback so held tokens like USDC
    // render their logo instead of the initials chip. Mobile has no icon map
    // on BalanceMap (unlike the extension's balances.icons) — icons come from
    // the injected getBalanceIconFn instead, which defaults to null.
    const icon = getBalanceIconFn(token.code, issuerKey) ?? null;

    const balanceDecimals =
      "decimals" in balance && typeof balance.decimals === "number"
        ? balance.decimals
        : null;

    byContract.set(contractId, {
      code: token.code,
      contractId,
      issuer: issuerKey,
      icon,
      // A classic asset reached here via Asset.contractId, so 7 is true by
      // definition. A Soroban balance carries its own decimals; if it somehow
      // arrives without them we don't know the scale.
      decimals: balanceDecimals ?? (directContractId ? null : DEFAULT_DECIMALS),
    });
  }

  return byContract;
};

export interface BuildTokenContextParams {
  tokenIds: string[];
  networkDetails: NetworkDetails;
  /** the active account; the token-details endpoint rejects an empty pub_key */
  publicKey: string;
  balances?: BalanceMap;
  /**
   * Curated verified-token records. Mobile's useVerifiedTokensStore returns
   * these already flattened across every configured list, so this is a flat
   * item array where the extension passed an array of list responses.
   */
  tokenListItems?: TokenListReponseItem[];
  /** injected: services/backend getTokenDetails, adapted to networkDetails */
  getTokenDetailsFn: (params: {
    contractId: string;
    publicKey: string;
    networkDetails: NetworkDetails;
  }) => Promise<{ symbol: string; decimals?: number } | null>;
  /** injected: helpers/getIconUrlFromTokensLists */
  getIconFn: (params: {
    contractId: string;
    code: string;
    tokenListItems?: TokenListReponseItem[];
  }) => Promise<{ icon?: string } | null>;
  /** injected; mobile has no icon map on BalanceMap, so this defaults to null */
  getBalanceIconFn?: (code: string, issuer: string | null) => string | null;
}

export const buildTokenContext = async ({
  tokenIds,
  networkDetails,
  publicKey,
  balances,
  tokenListItems = [],
  getTokenDetailsFn,
  getIconFn,
  getBalanceIconFn = () => null,
}: BuildTokenContextParams): Promise<TokenContext> => {
  const context: TokenContext = new Map();
  const uniqueIds = [...new Set(tokenIds)];

  const nativeContract = getNativeContractDetails(
    networkDetails.network,
  ).contract;
  const balancesByContract = indexBalancesByContractId(
    balances,
    networkDetails.networkPassphrase,
    getBalanceIconFn,
  );

  await Promise.all(
    uniqueIds.map(async (tokenId) => {
      // 1. native SAC
      if (tokenId === nativeContract) {
        context.set(tokenId, {
          code: "XLM",
          contractId: tokenId,
          issuer: null,
          icon: null,
          decimals: DEFAULT_DECIMALS,
        });
        return;
      }

      // 2. account balances
      const fromBalances = balancesByContract.get(tokenId);
      if (fromBalances) {
        context.set(tokenId, fromBalances);
        return;
      }

      // 3. curated token lists — code, decimals and icon with no network call
      const listed = findInTokenLists(tokenId, tokenListItems);
      // `decimals` is typed non-optional on TokenListReponseItem, but list
      // data comes from third-party list URLs, not this codebase's control,
      // so the runtime check still earns its place.
      if (listed && typeof listed.decimals === "number") {
        // for its icon → background cache side effect
        await getIconFn({
          contractId: tokenId,
          code: listed.code,
          tokenListItems,
        }).catch(() => null);
        context.set(tokenId, {
          code: listed.code,
          contractId: tokenId,
          issuer: null,
          icon: listed.icon || null,
          decimals: listed.decimals,
        });
        return;
      }

      // 4. token details. getTokenDetails swallows its own errors and returns
      // null, so both branches land on the fallback below.
      try {
        const details = await getTokenDetailsFn({
          contractId: tokenId,
          publicKey,
          networkDetails,
        });
        if (details && typeof details.decimals === "number") {
          const listMatch = await getIconFn({
            contractId: tokenId,
            code: details.symbol,
            tokenListItems,
          }).catch(() => null);
          context.set(tokenId, {
            code: details.symbol,
            contractId: tokenId,
            issuer: null,
            icon: listMatch?.icon || null,
            decimals: details.decimals,
          });
          return;
        }
        if (details) {
          // symbol without decimals: name the token, but don't scale amounts
          context.set(tokenId, {
            ...unresolvedToken(tokenId),
            code: details.symbol,
          });
          return;
        }
      } catch {
        // fall through to the fallback entry below
      }

      // 5. unresolved
      context.set(tokenId, unresolvedToken(tokenId));
    }),
  );

  return context;
};

/** Safe lookup with the same fallback shape buildTokenContext produces */
export const getResolvedToken = (
  context: TokenContext,
  tokenId: string,
): ResolvedToken => context.get(tokenId) ?? unresolvedToken(tokenId);
