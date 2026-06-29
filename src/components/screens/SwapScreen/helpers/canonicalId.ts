/**
 * Canonical CODE:ISSUER identifier used for deduping records across
 * sources (held balances, stellar.expert results, verified-tokens list).
 *
 * Native tokens (no issuer) collapse to just the token code. This shape
 * is intentionally NOT lowercased: Stellar token codes and issuers are
 * case-sensitive, and the rest of the codebase (balances, search
 * results) keys lookups on the same untransformed strings.
 */
export const canonicalId = (tokenCode: string, issuer: string): string =>
  issuer ? `${tokenCode}:${issuer}` : tokenCode;
