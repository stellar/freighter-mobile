/*
  Serializes the auth flows that change the wallet's accounts, sources or
  session. Each one reads the account list, the derivation indices, the
  source records and the encrypted temporary store, and writes them back
  whole. Two of them overlapping (a double tap, an add while the switcher
  loads the active key, a wipe while an import is still storing) let the
  later writer drop the earlier one's account, name, index or phrase, or
  write an account back into a wallet that was just wiped.

  Reads stay off the lock, so a slow Scrypt import doesn't stall them.

  The wipe waits on this lock too, so a holder must not await a network call
  without a timeout. Best-effort requests (source linking, analytics) run
  detached.

  Not reentrant: a holder that calls something that takes the lock again
  waits on itself forever. Take it at the store action, around the module
  function, and keep the reads that follow outside.
*/

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `fn` once every earlier holder has settled. A rejection still releases
 * the lock, and reaches the caller.
 *
 * @param {() => Promise<T>} fn - The work to run while holding the lock
 * @returns {Promise<T>} What `fn` resolves to
 */
export const withAccountMutationLock = <T>(
  fn: () => Promise<T>,
): Promise<T> => {
  const run = tail.then(fn);
  tail = run.catch(() => undefined);
  return run;
};
