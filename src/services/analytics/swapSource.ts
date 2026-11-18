/**
 * Where a swap was opened from, as every swap event carries it: `source` is
 * "token_details" or "earn", and absent for Home's Swap tab. The extension
 * sends the same.
 */
export const swapSourceProps = (
  entrySource: string | null | undefined,
): { source?: string } => (entrySource ? { source: entrySource } : {});
