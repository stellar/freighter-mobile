import { StellarToml, type Transaction, WebAuth } from "@stellar/stellar-sdk";
import { SEP10_FETCH_TIMEOUT_MS } from "config/constants";
import { logger } from "config/logger";

/**
 * A SEP-10 challenge the wallet fetched from the site's own WEB_AUTH_ENDPOINT,
 * verified and countersigned.
 */
export interface Sep10Auth {
  challengeXdr: string;
  signedXdr: string;
  networkPassphrase: string;
  homeDomain: string;
  webAuthEndpoint: string;
}

const fetchJson = async (url: string): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEP10_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Silent SEP-10 for a document the wallet already approved: read the site's
 * stellar.toml, fetch a challenge from its WEB_AUTH_ENDPOINT, verify it is a
 * genuine challenge for this origin and this account (server signature,
 * sequence 0, home and web-auth domains, timebounds), then countersign.
 * Anything short of that returns null and the dApp falls back to asking.
 * Only the TOML is trusted for the endpoint and signing key; nothing from the
 * page is.
 */
export const prepareSep10Auth = async ({
  origin,
  account,
  development,
  signTransaction,
}: {
  origin: string;
  account: { address: string; networkPassphrase: string };
  development: boolean;
  signTransaction: (tx: Transaction) => string | null;
}): Promise<Sep10Auth | null> => {
  try {
    const url = new URL(origin);
    const homeDomain = url.host;
    const allowHttp = development && url.protocol === "http:";
    const toml = (await StellarToml.Resolver.resolve(homeDomain, {
      allowHttp,
      timeout: SEP10_FETCH_TIMEOUT_MS,
    })) as Record<string, unknown>;
    const {
      WEB_AUTH_ENDPOINT: endpoint,
      SIGNING_KEY: signingKey,
      NETWORK_PASSPHRASE: passphrase,
    } = toml;
    if (
      typeof endpoint !== "string" ||
      typeof signingKey !== "string" ||
      typeof passphrase !== "string"
    )
      throw new Error("toml lacks SEP-10 fields");
    if (passphrase !== account.networkPassphrase)
      throw new Error("toml network differs from wallet");
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:" && !allowHttp)
      throw new Error("non-https WEB_AUTH_ENDPOINT");
    endpointUrl.searchParams.set("account", account.address);
    const body = await fetchJson(endpointUrl.toString());
    const challengeXdr = body.transaction;
    if (
      typeof challengeXdr !== "string" ||
      (body.network_passphrase ?? body.networkPassphrase) !== passphrase
    )
      throw new Error("challenge response malformed");
    // Throws on a bad server signature, non-zero sequence, wrong domains or
    // expired timebounds. The home domain must be exactly the page's host: a
    // subdomain the site does not control could otherwise publish a TOML
    // naming the parent's real SIGNING_KEY and endpoint, obtain a genuine
    // parent-domain challenge for the user, and replay the wallet's silent
    // signature to hijack the user's session on the parent site.
    const parsed = WebAuth.readChallengeTx(
      challengeXdr,
      signingKey,
      passphrase,
      homeDomain,
      endpointUrl.host,
    );
    if (parsed.clientAccountID !== account.address)
      throw new Error("challenge is for another account");
    // readChallengeTx only validates web_auth_domain when present; require it
    // so the challenge is bound to the endpoint host.
    if (
      !parsed.tx.operations.some(
        (op) => op.type === "manageData" && op.name === "web_auth_domain",
      )
    )
      throw new Error("challenge lacks web_auth_domain");
    const signedXdr = signTransaction(parsed.tx);
    if (!signedXdr) return null;
    return {
      challengeXdr,
      signedXdr,
      networkPassphrase: passphrase,
      homeDomain,
      webAuthEndpoint: endpoint,
    };
  } catch (error) {
    logger.warn("WebViewSep10", "auto sign-in unavailable", { origin, error });
    return null;
  }
};
