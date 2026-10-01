import { Balance, PricedBalance } from "config/types";
import { getTokenIdentifier } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import { getCatalogContractId } from "helpers/tokenCatalog";

/**
 * The contract id of a Soroban token balance, or undefined for native and classic
 * balances. A Soroban token keeps its contract id where a classic one keeps its
 * issuer, so the swap flow treats both alike ("CODE:ISSUER", "SYMBOL:CONTRACT").
 * Takes any balance, priced or not.
 */
export const getSorobanContractId = (balance: Balance): string | undefined => {
  if (!("token" in balance) || !("issuer" in balance.token)) return undefined;
  const { key } = balance.token.issuer;

  return isContractId(key) ? key : undefined;
};

/**
 * The asset as the swap quote route names it: "XLM", "CODE:ISSUER", or the
 * contract id of a Soroban token.
 */
export const swapAssetId = (balance: PricedBalance): string =>
  getSorobanContractId(balance) ?? getTokenIdentifier(balance);

/**
 * The Soroban contract that carries the asset: the token's own contract, or the
 * Stellar Asset Contract of a classic asset. Throws for a balance that names no
 * token, so a swap is never built for an asset that cannot be identified.
 */
export const swapContractId = (
  balance: PricedBalance,
  networkPassphrase: string,
): string => {
  const contractId = getCatalogContractId(
    swapAssetId(balance),
    networkPassphrase,
  );
  if (!contractId) throw new Error("Unsupported token type for swap");

  return contractId;
};
