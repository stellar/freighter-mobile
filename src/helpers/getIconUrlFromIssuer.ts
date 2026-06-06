import { Horizon, StellarToml, StrKey } from "@stellar/stellar-sdk";
import { NETWORK_URLS } from "config/constants";
import { debug } from "helpers/debug";

/**
 * Retrieves an icon URL for a Stellar token based on its issuer information.
 *
 * This function follows a multi-step process to find a token's icon URL:
 * 1. Queries Horizon to get the issuer account information, including home domain
 * 2. Retrieves the stellar.toml file from the issuer's home domain
 * 3. Searches the toml file's CURRENCIES section for matching token code and issuer
 * 4. Returns the image URL if found, or empty string if any step fails
 *
 * The process requires multiple network requests:
 * - One to Horizon to get issuer info
 * - One to the issuer's domain to get the stellar.toml file
 * - Later, one to fetch the actual image (handled by the caller)
 *
 * @param {Object} params - Parameters for icon URL retrieval
 * @param {string} params.issuerKey - The public key of the token issuer
 * @param {string} params.tokenCode - The code of the token (e.g., "USDC", "BTC")
 * @param {string} params.networkUrl - Network URL which is used to fetch the icon
 * @returns {Promise<string>} A promise that resolves to the icon URL if found, or empty string otherwise
 *
 * @example
 * // Get icon URL for USDC on testnet
 * const iconUrl = await getIconUrlFromIssuer({
 *   issuerKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
 *   tokenCode: "USDC",
 *   networkUrl: "https://horizon-testnet.stellar.org"
 * });
 */

export const getIconUrlFromIssuer = async ({
  issuerKey,
  tokenCode,
  networkUrl,
}: {
  issuerKey: string;
  tokenCode: string;
  networkUrl: NETWORK_URLS;
}): Promise<string> => {
  if (!StrKey.isValidEd25519PublicKey(issuerKey)) {
    debug("getIconUrlFromIssuer", "Invalid issuer key", issuerKey);
    return "";
  }

  let homeDomain;
  try {
    const server = new Horizon.Server(networkUrl);
    const account = await server.loadAccount(issuerKey);
    homeDomain = account.home_domain;
  } catch (e) {
    debug(
      "getIconUrlFromIssuer",
      "Failed to load account, error:",
      e,
      " params: ",
      {
        issuerKey,
        tokenCode,
        networkUrl,
      },
    );
    return "";
  }

  if (!homeDomain) {
    debug("getIconUrlFromIssuer", "No home domain found for issuer", issuerKey);
    return "";
  }

  let toml;
  try {
    toml = await StellarToml.Resolver.resolve(homeDomain);
  } catch (e) {
    // Hermes (React Native's JS engine on iOS/Android) caps own-property
    // count on a single object at 196_607 — when a TOML deserializes into
    // an object that wide (huge CURRENCIES list, or non-TOML content that
    // the parser absorbs as a flood of keys) the engine throws RangeError
    // "Property storage exceeds 196607 properties". The SDK wraps it as
    // "stellar.toml is invalid - Parsing error on line undefined, column
    // undefined: ...". Surface it separately from generic TOML failures so
    // the culprit issuer + domain is easy to spot in dev logs.
    const errMessage = e?.toString() || "unknown";
    const hitHermesPropertyCap = errMessage.includes(
      "Property storage exceeds",
    );
    debug(
      "getIconUrlFromIssuer",
      hitHermesPropertyCap
        ? "TOML parse exceeded Hermes property-storage cap (pathological / non-TOML response)"
        : "Failed to resolve TOML",
      errMessage,
      { issuerKey, tokenCode, homeDomain },
    );
    return "";
  }

  if (!toml.CURRENCIES) {
    debug("getIconUrlFromIssuer", "No CURRENCIES found in TOML", homeDomain);
    return "";
  }

  const currency = toml.CURRENCIES.find(
    ({ code, issuer, image }) =>
      code === tokenCode && issuer === issuerKey && !!image,
  );

  return currency?.image || "";
};
