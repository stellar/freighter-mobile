import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { DEFAULT_DECIMALS, NATIVE_TOKEN_CODE } from "config/constants";
import {
  FormattedSearchTokenRecord,
  PricedBalance,
  TokenTypeWithCustomToken,
} from "config/types";
import { getTokenType } from "helpers/balances";

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
};

/**
 * Project a held PricedBalance into a DestinationTokenDescriptor.
 * `isNew` is always false because the user already has a trustline.
 */
export const descriptorFromBalance = (
  balance: BalanceInput,
): DestinationTokenDescriptor => {
  const id = balance.id ?? NATIVE_TOKEN_CODE;
  const isNative = id === NATIVE_TOKEN_CODE || id === "native";

  if (isNative) {
    return {
      id: "native",
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
    return {
      id: "native",
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
  };
};
