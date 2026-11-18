/**
 * Where a swap was opened from, as every swap event carries it: `source` is
 * "home", "token_details" or "earn". Every host stamps one, so it is left off
 * only for a swap event that no host started. The extension sends the same.
 */
export const swapSourceProps = (
  entrySource: string | null | undefined,
): { source?: string } => (entrySource ? { source: entrySource } : {});
