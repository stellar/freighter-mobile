import { SecretSource, SecretSourceType } from "config/types";

/**
 * Whether the wallet holds a recovery phrase to show. A wallet onboarded from
 * a secret key holds only SECRET_KEY sources and has none. An empty list
 * means the sources haven't loaded (or predate source records), so it stays
 * permissive.
 */
export const hasRecoveryPhrase = (sources: SecretSource[]): boolean =>
  sources.length === 0 ||
  sources.some(({ type }) => type === SecretSourceType.PHRASE);
