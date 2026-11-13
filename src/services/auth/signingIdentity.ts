import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import { SecretSourceType } from "config/types";
import { getLinkStatus } from "services/auth/linkStatus";
import {
  getFirstSourceId,
  getPinnedSourceId,
} from "services/auth/secretSources";
import { getWalletSources } from "services/auth/walletSources";

/*
  The one place that decides which identity the wallet speaks as. Backend
  auth (attachAuth) and the analytics id (getAuthUserId) both resolve through
  here; add a new identity consumer by calling this, not by re-deriving from a
  phrase.

  The JWT signer decides the user (unified-user-model/v2.md "Request
  signing"), so the wallet always signs with its pinned source: the first
  source it registered (see addSecretSource). It never follows the active
  account, so switching accounts changes neither `sub` nor the resolved user.

  This never writes the pin. Only registration (addSecretSource) and unlock
  (signIn) do, from the persisted source set. A request can run before
  unlock has repaired a missing pin, or overlap a wallet wipe, and a pin
  written from whatever one request derived would stick to the wrong
  source: an import's key when the phrase failed to derive, or the old
  wallet's phrase after a wipe.

  The signers come from getWalletSources, which caches them for the unlock,
  so a request pays no PBKDF2 once the sign-in warm-up has run.
*/

export interface SigningIdentity {
  /** The JWT `sub`: lowercase hex Ed25519 public key. */
  sourceId: string;
  keypair: Keypair;
}

/**
 * The pinned source and its signer, or null when the session holds no
 * signer (locked, or nothing held). A null means "send anonymously". Total:
 * never throws, so request-layer callers can fall back to anonymous.
 *
 * - The pinned source is held: sign with it. With no pin, as after a failed
 *   pin write, the earliest registered source stands in for it (the source
 *   the next registration or unlock will pin).
 * - That source is not held, as when it failed to derive this unlock: sign
 *   with a held source the server listed in this wallet's cluster
 *   ("linked"), else one it has not answered for yet, phrases first in each
 *   case. Never sign with a source the server reported as another user's
 *   ("conflict"): that would speak as that user. With only those held,
 *   return null. The pin stays put, so a source that failed to derive this
 *   unlock cannot move it; moving it waits for account removal, the first
 *   way a pinned source can leave the wallet for good.
 * - Nothing pinned and nothing registered, as for an upgraded wallet before
 *   its first sign-in: sign with the first held phrase, the source the
 *   migration will pin, or return null when no phrase derived. Nothing is
 *   persisted, so a wrong guess lasts one request.
 */
export const getSigningIdentity = async (): Promise<SigningIdentity | null> => {
  try {
    const { sources, signers } = await getWalletSources();
    if (!sources.length) {
      return null;
    }

    const pinned = (await getPinnedSourceId()) ?? (await getFirstSourceId());

    if (!pinned) {
      // Never an import's key: one that stood in here would root a
      // server-side user at the wrong source.
      const phrase = sources.find(
        ({ kind }) => kind === SecretSourceType.PHRASE,
      );
      return phrase
        ? { sourceId: phrase.id, keypair: signers.get(phrase.id)! }
        : null;
    }

    const pinnedSigner = signers.get(pinned);
    if (pinnedSigner) {
      return { sourceId: pinned, keypair: pinnedSigner };
    }

    logger.error(
      "getSigningIdentity",
      "The pinned source is not held",
      new Error("The pinned source is not held"),
    );
    const status = await getLinkStatus();
    const fallback =
      sources.find(({ id }) => status[id] === "linked") ??
      sources.find(({ id }) => status[id] === undefined);
    return fallback
      ? { sourceId: fallback.id, keypair: signers.get(fallback.id)! }
      : null;
  } catch (error) {
    // A locked or empty wallet is handled above, so anything reaching here
    // is unexpected (a PBKDF2 failure, a storage read error). Log it:
    // otherwise an unlocked user silently goes anonymous with no signal.
    logger.error("getSigningIdentity", "Unexpected error", error);
    return null;
  }
};
