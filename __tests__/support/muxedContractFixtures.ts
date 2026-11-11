/**
 * Muxed contract (`W…`) fixtures shared by the suites that exercise them.
 *
 * Test-only, so it lives under `__tests__/support` rather than `src/helpers`.
 * The pairings were checked against the real `@stellar/stellar-sdk` 17.4.0:
 * encoding `BASE_CONTRACT` with a mux id gives the `W…` documented beside it,
 * and encoding `G_ACCOUNT` with id 1234 gives `M_ACCOUNT_ID_1234`.
 */

export const BASE_CONTRACT =
  "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA";

/** `BASE_CONTRACT` with mux id 0 (SEP-23 vector). */
export const MUXED_CONTRACT_ID_0 =
  "WA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAAAWWC";

/** `BASE_CONTRACT` with mux id 1234. */
export const MUXED_CONTRACT_ID_1234 =
  "WA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAE2LLEM";

/** `BASE_CONTRACT` with the largest mux id, 2^64 - 1. */
export const MUXED_CONTRACT_ID_U64_MAX =
  "WA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV7777777777777GMO";

/** 2^64 - 1 as a decimal string. It does not survive a `Number` round trip. */
export const U64_MAX = "18446744073709551615";

export const G_ACCOUNT =
  "GA4EFTUDCDT7QNG2FXFISAH7W3V42BIYINBGCMPS7ZUFUR6KBWG2QTPH";

/** `G_ACCOUNT` with mux id 1234, the account-side (`M…`) counterpart. */
export const M_ACCOUNT_ID_1234 =
  "MA4EFTUDCDT7QNG2FXFISAH7W3V42BIYINBGCMPS7ZUFUR6KBWG2QAAAAAAAAAAE2L5WK";
