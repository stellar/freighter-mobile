import { TokenTypeWithCustomToken } from "config/types";
import { SecurityLevel } from "services/blockaid/constants";

/**
 * Narrow descriptor for the destination side of a swap.
 *
 * The destination can be a token the user already holds OR a token they
 * don't (selected from the picker's Popular/Search sections, or the Trending
 * list). No synthetic balance required.
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
   * the descriptor so the Receive-icon badge renders without a separate scan
   * lookup. Only populated when the descriptor comes from a scanned search
   * record; held tokens already render their badge through their balance row.
   */
  securityLevel?: SecurityLevel;
  /**
   * Issuer-toml-declared logo URL (stellar.expert's `tomlInfo.image`),
   * carried through from the search record so the Receive chip can render
   * the same logo the picker row showed pre-tap. Without this the chip
   * falls back to a 2-letter avatar until the trustline is added and the
   * icons store hydrates.
   *
   * Left undefined for held tokens — they resolve their icon through the
   * existing icon-store lookup keyed by `code:issuer`.
   */
  iconUrl?: string;
};
