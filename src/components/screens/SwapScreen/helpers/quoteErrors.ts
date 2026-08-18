/** Horizon op result codes meaning the quoted strictSend path is no longer
 * valid (price moved past slippage / liquidity changed) → retry for a fresh
 * quote rather than surfacing a generic failure. */
export const QUOTE_EXPIRED_OPERATION_CODES = [
  "op_under_dest_min",
  "op_too_few_offers",
];

/** The quote-expired op codes present in `resultCodes.operations` (empty when
 * none). Used to tag the analytics event with which code drove the expiry. */
export const getQuoteExpiredOperationCodes = (
  resultCodes:
    | { transaction?: string; operations?: string[] }
    | null
    | undefined,
): string[] =>
  resultCodes?.operations?.filter((code) =>
    QUOTE_EXPIRED_OPERATION_CODES.includes(code),
  ) ?? [];

/** True iff `resultCodes.operations` contains any quote-expired op code. */
export const isQuoteExpiredResultCodes = (
  resultCodes:
    | { transaction?: string; operations?: string[] }
    | null
    | undefined,
): boolean => getQuoteExpiredOperationCodes(resultCodes).length > 0;
