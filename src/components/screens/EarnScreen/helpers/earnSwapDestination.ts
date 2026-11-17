import { StrKey } from "@stellar/stellar-sdk";
import { EarnTokenOption } from "components/screens/EarnScreen/hooks/useEarnTokens";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { Balance, Token, TokenTypeWithCustomToken } from "config/types";

/**
 * Classic asset codes are alphanum4 up to 4 characters, alphanum12 beyond.
 * Blend's current reserves are all <= 5 characters (XLM/USDC/EURC), but the
 * catalog is operator-configured, so this is derived rather than assumed.
 */
const ALPHANUM4_MAX_CODE_LENGTH = 4;

/**
 * Splits the catalog's canonical asset id ("CODE:ISSUER") into a classic code
 * and issuer. Null unless the issuer is a real account key: the catalog is
 * backend data, and anything else there (a contract id, a typo) is not an
 * issuer.
 */
export const parseCanonicalAsset = (
  canonical: string | null | undefined,
): { code: string; issuer: string } | null => {
  if (!canonical) {
    return null;
  }

  const separatorIndex = canonical.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === canonical.length - 1) {
    return null;
  }

  const code = canonical.slice(0, separatorIndex);
  const issuer = canonical.slice(separatorIndex + 1);
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    return null;
  }

  return { code, issuer };
};

/**
 * The token to draw a reserve's icon from.
 *
 * A held reserve uses its balance. Otherwise native XLM is native, and any
 * other reserve is keyed by its classic code and issuer, the key the icon
 * cache stores tokens under: keyed by its contract id, an icon was never
 * found, and only the logos the app ships (XLM, Circle's USDC) showed. The
 * contract id is left only for a reserve the catalog gives no classic form.
 */
export const getEarnOptionToken = (
  option: EarnTokenOption,
): Token | Balance => {
  if (option.balance) {
    return option.balance;
  }
  if (option.isNative) {
    return { type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" };
  }

  const classic = parseCanonicalAsset(option.canonicalId);
  return classic
    ? { code: classic.code, issuer: { key: classic.issuer } }
    : { code: option.code, issuer: { key: option.assetId } };
};

/**
 * Build the swap destination for "Swap for {CODE}" from the Earn reserve the
 * user was trying to deposit into.
 *
 * Earn addresses its reserves by Stellar Asset Contract id, but swapping is
 * classic-only -- `pathPaymentStrictSend` rejects contract-id assets outright
 * -- so the destination has to be expressed as code + issuer. A SAC address
 * is a hash and cannot be decomposed back into one, which is why this reads
 * `canonicalId` (the catalog's "CODE:ISSUER") instead of `assetId`.
 *
 * Returns null when the reserve cannot be expressed classically: native XLM
 * is handled explicitly, but a non-native reserve with no `canonicalId` has
 * no issuer to swap toward. Callers must treat null as "no swap path" rather
 * than falling back to `assetId`, which would build a descriptor the path
 * finder silently fails on.
 */
export const buildEarnSwapDestination = (
  option: EarnTokenOption,
): DestinationTokenDescriptor | null => {
  if (option.isNative) {
    return {
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      decimals: option.decimals,
      tokenType: "native" as TokenTypeWithCustomToken,
      // Native XLM never needs one, and the account demonstrably exists --
      // it is holding the balance that funded getting this far.
      requiresTrustline: false,
    };
  }

  // The catalog's name is backend data: only a real account key may become
  // the issuer of the asset the swap buys.
  const classic = parseCanonicalAsset(option.canonicalId);
  if (!classic) {
    return null;
  }
  const { code: tokenCode, issuer } = classic;

  return {
    id: `${tokenCode}:${issuer}`,
    tokenCode,
    issuer,
    decimals: option.decimals,
    tokenType: (tokenCode.length > ALPHANUM4_MAX_CODE_LENGTH
      ? "credit_alphanum12"
      : "credit_alphanum4") as TokenTypeWithCustomToken,
    // The sheet is only ever reached from a zero-balance reserve row, so the
    // account holds none of it. `option.balance` stays authoritative anyway:
    // a dust balance below the deposit minimum would still be a trustline.
    requiresTrustline: !option.balance,
  };
};
