import { Horizon, StellarToml, StrKey } from "@stellar/stellar-sdk";
import { NETWORK_URLS } from "config/constants";
import { debug } from "helpers/debug";

/**
 * Resolves a token's icon URL by reading the issuer's home_domain from Horizon
 * and looking up its stellar.toml CURRENCIES entry. Returns "" on any failure.
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
