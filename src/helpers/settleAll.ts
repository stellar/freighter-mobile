/**
 * Like `Promise.all`, but it doesn't fail fast: it waits for every promise
 * to settle, then throws the first rejection's reason (in input order) or
 * returns the values in order.
 *
 * Use it for writes that a caller rolls back on failure. With
 * `Promise.all`, a write still running when another fails can land after
 * the rollback and undo it.
 */
export const settleAll = async <T extends readonly unknown[] | []>(
  promises: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> => {
  // Widened for the loop; the typed tuple is restored on return.
  const results = await Promise.allSettled(promises as readonly unknown[]);
  const values = results.map((result) => {
    if (result.status === "rejected") {
      throw result.reason;
    }
    return result.value;
  });

  return values as { -readonly [K in keyof T]: Awaited<T[K]> };
};
