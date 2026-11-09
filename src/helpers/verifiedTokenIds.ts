import { StrKey } from "@stellar/stellar-sdk";

/**
 * Identity keys for checking a token against the verified token lists.
 *
 * A classic token is the pair (code, issuer). An issuer can mint any number of
 * codes, and a list that vouches for one of them does not vouch for the
 * others, so a classic token is keyed by CODE:issuer and never by the issuer
 * alone. Codes are case-sensitive (USDE and USDe are different tokens), so
 * only the address part is lowercased. Contract tokens are keyed by their
 * contract ID.
 */
const contractKey = (contractId: string) => contractId.toLowerCase();

const classicKey = (tokenCode: string, issuer: string) =>
  `${tokenCode}:${issuer.toLowerCase()}`;

/**
 * Builds the set of identity keys the verified token lists vouch for: each
 * entry's contract ID, and its CODE:issuer pair.
 */
export const buildVerifiedTokenIds = (
  verifiedTokens: { code?: string; issuer?: string; contract?: string }[],
): Set<string> => {
  const verifiedIds = new Set<string>();
  verifiedTokens.forEach(({ code, issuer, contract }) => {
    if (contract) {
      verifiedIds.add(contractKey(contract));
    }
    if (issuer && StrKey.isValidContract(issuer)) {
      verifiedIds.add(contractKey(issuer));
    } else if (code && issuer) {
      verifiedIds.add(classicKey(code, issuer));
    }
  });
  return verifiedIds;
};

/**
 * True when the verified token lists vouch for this token. Contract tokens
 * carry their contract ID in the issuer field, so the issuer is checked as a
 * contract ID as well as part of a CODE:issuer pair.
 */
export const isTokenInVerifiedIds = (
  verifiedIds: Set<string>,
  token: { tokenCode: string; issuer: string },
): boolean => {
  const { tokenCode, issuer } = token;
  if (!issuer) {
    return false;
  }
  return (
    verifiedIds.has(contractKey(issuer)) ||
    verifiedIds.has(classicKey(tokenCode, issuer))
  );
};
