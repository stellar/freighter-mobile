import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import {
  DEFAULT_DECIMALS,
  isNativeAssetId,
  NATIVE_TOKEN_CODE,
} from "config/constants";
import {
  FormattedSearchTokenRecord,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { getTokenType } from "helpers/balances";
import { assessTokenSecurity } from "services/blockaid/helper";

/**
 * Extended balance descriptor that captures the optional fields that callers
 * attach to PricedBalance entries before passing them to this helper.
 */
type BalanceInput = PricedBalance & {
  id?: string;
  tokenCode?: string;
  decimals?: number;
  tokenType?: TokenTypeWithCustomToken;
  token?: {
    // Widened to string to accommodate NativeToken.type = "native" literal
    // which TypeScript does not automatically treat as TokenTypeWithCustomToken.NATIVE.
    type?: TokenTypeWithCustomToken | string;
    code?: string;
    issuer?: { key: string };
  };
  blockaidData?: unknown;
};

/**
 * Project a held PricedBalance into a DestinationTokenDescriptor.
 * `isNew` is always false because the user already has a trustline.
 */
export const descriptorFromBalance = (
  balance: BalanceInput,
): DestinationTokenDescriptor => {
  const id = balance.id ?? NATIVE_TOKEN_CODE;
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
  const heldSecurityLevel = balance.blockaidData
    ? assessTokenSecurity(
        balance.blockaidData as Parameters<typeof assessTokenSecurity>[0],
      ).level
    : undefined;

  return {
    id,
    tokenCode: tokenCode || balance.tokenCode || "",
    issuer: issuer || undefined,
    decimals: balance.decimals ?? DEFAULT_DECIMALS,
    tokenType:
      (balance.token?.type as TokenTypeWithCustomToken | undefined) ??
      balance.tokenType ??
      getTokenType(id),
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
