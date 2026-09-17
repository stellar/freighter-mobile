import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { TokenIdentifier, TokenTypeWithCustomToken } from "config/types";
import { isNativeAssetId, isNativeContract } from "helpers/assetIdentity";
import { getTokenType } from "helpers/balances";
import { getTokenFromTokenId } from "helpers/history";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

/**
 * The About card's Type row and the `token_type` analytics property. Closed
 * and shared with the extension — the values must not change.
 */
export type TokenKind = "native" | "classic" | "soroban";

/**
 * Comparing a resolved `TokenKind` is not an asset-code comparison, but the
 * asset-identity lint rule cannot tell it from Horizon's native asset-type
 * string — so the value is named once rather than spelled at each site.
 */
const NATIVE_KIND: TokenKind = "native";

/**
 * True when `classifyToken` placed the identifier in the native kind. Prefer
 * this over comparing a `TokenKind` to a literal.
 */
export const isNativeKind = (kind: TokenKind): boolean => kind === NATIVE_KIND;

export interface ClassifiedToken {
  kind: TokenKind;
  /**
   * The issuer G-address (classic) or contract ID (Soroban), when the
   * identifier carries one; null for XLM and for a bare token code.
   */
  address: string | null;
}

/**
 * Every identifier form the detail screen can hold — "native"/"XLM",
 * CODE:ISSUER, SYMBOL:CONTRACTID, bare contract id — to a kind and address.
 * One implementation on purpose: the About card and the chart analytics used
 * to classify the same identifier by subtly different rules.
 */
export const classifyToken = (
  tokenId: TokenIdentifier,
  network?: NETWORKS,
): ClassifiedToken => {
  if (isNativeAssetId(tokenId)) {
    return { kind: NATIVE_KIND, address: null };
  }

  // The repo's existing identifier parser: resolves a bare contract ID and
  // the SYMBOL:CONTRACTID form to `contractId`, CODE:ISSUER to `issuer`.
  const { issuer, contractId } = getTokenFromTokenId(tokenId);

  if (contractId) {
    // XLM's own SAC is a contract id by shape but IS the native asset;
    // falling through would label it "Soroban" on the card and in a frozen
    // analytics dimension. The SAC id derives from the passphrase, hence the
    // optional parameter.
    if (
      network &&
      isNativeContract(
        contractId,
        mapNetworkToNetworkDetails(network).networkPassphrase,
      )
    ) {
      return { kind: NATIVE_KIND, address: null };
    }
    return { kind: "soroban", address: contractId };
  }

  // A C-prefixed issuer that isn't a decodable contract ID still counts as a
  // custom token at the balance layer; keep that classification here too.
  const kind =
    getTokenType(tokenId) === TokenTypeWithCustomToken.CUSTOM_TOKEN
      ? "soroban"
      : "classic";

  return { kind, address: issuer ?? null };
};

/**
 * Asset-identity properties for a chart event, byte-for-byte identical to the
 * extension's `getChartAssetIdentity`. `asset_issuer` is the ASSET's issuer,
 * identical for every holder — not the viewer's key, which rides on every
 * event as the hashed `account_id_hash`. Absent halves are omitted rather
 * than sent empty: a bare `C…` id reports an issuer and no code.
 */
export const getChartAssetIdentity = (
  tokenId: TokenIdentifier,
  network?: NETWORKS,
): { asset_code?: string; asset_issuer?: string; token_type: TokenKind } => {
  // The emitted property is snake_case per the analytics property model; the
  // local binding is camelCase per the lint rule. Both are deliberate.
  const tokenType = classifyToken(tokenId, network).kind;

  // Branch on the RESOLVED kind, never the identifier's shape: XLM's SAC
  // arrives as `XLM:<contract id>`, and a shape check would emit an
  // `asset_issuer` beside `token_type: "native"`, splitting native XLM into
  // two identities depending on how the user reached it.
  if (tokenType === NATIVE_KIND) {
    return { asset_code: "XLM", token_type: tokenType };
  }
  if (tokenId.includes(":")) {
    const [code, issuer] = tokenId.split(":");
    return {
      ...(code ? { asset_code: code } : {}),
      ...(issuer ? { asset_issuer: issuer } : {}),
      token_type: tokenType,
    };
  }
  return { asset_issuer: tokenId, token_type: tokenType };
};
