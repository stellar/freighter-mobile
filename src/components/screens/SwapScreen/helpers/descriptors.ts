import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import {
  DEFAULT_DECIMALS,
  isNativeAssetId,
  NATIVE_TOKEN_CODE,
} from "config/constants";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { assessTokenSecurity } from "services/blockaid/helper";

/**
 * Project a held balance into a DestinationTokenDescriptor.
 * `isNew` is always false because the user already has a trustline.
 *
 * Some PricedBalance variants (Soroban) carry `decimals` / `blockaidData`
 * that the union doesn't expose unconditionally — we read them via
 * `in`-narrowing rather than the previous over-permissive BalanceInput
 * shim that re-declared every field as optional + widened
 * `token.type` to `string`.
 */
export const descriptorFromBalance = (
  balance: HeldBalanceItem,
): DestinationTokenDescriptor => {
  const { id } = balance;
  const isNative = isNativeAssetId(id);

  if (isNative) {
    // Use NATIVE_TOKEN_CODE ("XLM") not "native" so the descriptor id
    // matches the production balance store id (services/backend.ts
    // converts Horizon's "native" → "XLM" before storage). Lookups
    // like `balanceItems.find(b => b.id === descriptor.id)` then
    // succeed for XLM-as-destination — without this, the swap-direction
    // toggle stays disabled and the balance line below the Receive
    // pill stays empty when XLM is selected.
    return {
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      issuer: undefined,
      decimals: DEFAULT_DECIMALS,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    };
  }

  // "USDC:GA5Z..." or contract id for Soroban (we filter Soroban out upstream)
  const [tokenCode, issuer] = id.includes(":")
    ? id.split(":")
    : [balance.tokenCode ?? "", ""];

  // Project Blockaid signal from the held balance's bulk-scan blob so
  // downstream callers see a consistent securityLevel shape regardless
  // of whether the descriptor came from a balance or a search record.
  const heldSecurityLevel =
    "blockaidData" in balance && balance.blockaidData
      ? assessTokenSecurity(balance.blockaidData).level
      : undefined;

  // `decimals` lives on SorobanBalance only (the union doesn't expose
  // it unconditionally); classic + native balances use the default.
  const decimals =
    "decimals" in balance && typeof balance.decimals === "number"
      ? balance.decimals
      : DEFAULT_DECIMALS;

  return {
    id,
    tokenCode: tokenCode || balance.tokenCode || "",
    issuer: issuer || undefined,
    decimals,
    tokenType: balance.tokenType,
    isNew: false,
    securityLevel: heldSecurityLevel,
  };
};

/**
 * Project a stellar.expert / verified-list record into a descriptor.
 * `isNew` is true unless the record is already in the user's balances
 * (hasTrustline flag set by `useSwapTokenLookup`).
 */
export const descriptorFromSearchRecord = (
  record: FormattedSearchTokenRecord,
): DestinationTokenDescriptor => {
  if (record.isNative) {
    // See descriptorFromBalance's native branch for the rationale —
    // the canonical native id is NATIVE_TOKEN_CODE ("XLM"), matching
    // the production balance store.
    return {
      id: NATIVE_TOKEN_CODE,
      tokenCode: NATIVE_TOKEN_CODE,
      issuer: undefined,
      decimals: DEFAULT_DECIMALS,
      tokenType: TokenTypeWithCustomToken.NATIVE,
      isNew: false,
    };
  }

  return {
    id: `${record.tokenCode}:${record.issuer}`,
    tokenCode: record.tokenCode,
    issuer: record.issuer,
    decimals: record.decimals ?? DEFAULT_DECIMALS,
    tokenType:
      record.tokenType ??
      (record.tokenCode.length <= 4
        ? TokenTypeWithCustomToken.CREDIT_ALPHANUM4
        : TokenTypeWithCustomToken.CREDIT_ALPHANUM12),
    isNew: !record.hasTrustline,
    securityLevel: record.securityLevel,
    // Real Blockaid warnings from the search record's bulk scan — needed
    // because the destination side has no PricedBalance for non-held
    // tokens, so useSwapSecurityAssessments otherwise has to synthesise
    // a scan from securityLevel alone (which omits the feature rows).
    securityWarnings: record.securityWarnings,
    // Carry the search-record's tomlInfo.image-derived iconUrl through to
    // the swap store so the SwapAmountScreen Receive chip can render the
    // same logo the picker row already showed. Undefined when stellar.expert
    // didn't return a tomlInfo.image for the asset (the chip stays on its
    // 2-letter fallback in that case, matching the picker row).
    iconUrl: record.iconUrl,
  };
};
