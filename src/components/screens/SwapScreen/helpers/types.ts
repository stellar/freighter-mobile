import { TokenTypeWithCustomToken } from "config/types";
import { SecurityLevel } from "services/blockaid/constants";

/**
 * Narrow descriptor for the destination side of a swap.
 *
 * The destination can be a token the user already holds OR a token they
 * don't (selected from the picker's Popular/Search sections, or the Trending
 * list). This shape is the minimal information `findSwapPath`,
 * `buildSwapTransaction`, and the review sheet actually consume — no
 * synthetic balance required.
 */
export type DestinationTokenDescriptor = {
  /** "XLM" for native, "CODE:ISSUER" for classic. */
  id: string;
  tokenCode: string;
  /** Omitted for native XLM. */
  issuer?: string;
  /** Defaults to 7 for classic; tomlInfo.decimals if present. */
  decimals: number;
  tokenType: TokenTypeWithCustomToken;
  /** `false` when the user already has a trustline; `true` for new tokens. */
  isNew: boolean;
  /**
   * Blockaid security level for the destination token, when known. Carried on
   * the descriptor so the in-place Receive-icon badge renders without a
   * separate scan lookup (spec §9 + Figma 11310-104182). Only populated when
   * the descriptor comes from a scanned search record; held tokens already
   * render their badge through `BalanceRow`/`assessTokenSecurity`.
   */
  securityLevel?: SecurityLevel;
};
