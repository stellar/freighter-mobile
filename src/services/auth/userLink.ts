import { Keypair } from "@stellar/stellar-sdk";
import { getPinnedSourceId } from "services/auth/secretSources";
import {
  getSigningIdentity,
  SigningIdentity,
} from "services/auth/signingIdentity";
import {
  buildLinkConsentMessage,
  MAX_LINK_SOURCES,
  signLinkConsent,
  UserLinkBody,
} from "services/auth/userLinkConsent";
import { getWalletSources, WalletSource } from "services/auth/walletSources";

/*
  Builds the signed bodies for POST /api/v1/user/link (#67). The call's job is
  to register every held source under the user the pinned source resolves to
  (unified-user-model/v2.md "API Examples"). linkSources.ts sends them and
  linkStatus.ts records what the server answered (#68).

  Every body carries `sub`, the signing source: a call without it would create
  a user no source resolves to, and the server rejects it. Each source in the
  body signs its own consent, bound to `sub` and the JWT's iat.
*/

/**
 * Groups the sources into one batch per call, each at most MAX_LINK_SOURCES
 * entries and each starting with `sub`. Sources in `linkedIds` are left out;
 * `sub` is sent anyway while any other source is pending. Returns [] once
 * every source is linked.
 *
 * Duplicate ids collapse to the first occurrence: the server rejects a
 * repeated id with 400.
 */
export const batchUserLinkSources = ({
  identity,
  sources,
  linkedIds = new Set(),
}: {
  identity: SigningIdentity;
  sources: WalletSource[];
  linkedIds?: ReadonlySet<string>;
}): WalletSource[][] => {
  const unique = new Map<string, WalletSource>();
  sources.forEach((source) => {
    if (!unique.has(source.id)) {
      unique.set(source.id, source);
    }
  });

  const sub = unique.get(identity.sourceId);
  if (!sub) {
    // getSigningIdentity picks from the same set, so this is a caller bug.
    // Fail here rather than send a body the server is certain to reject.
    throw new Error("buildUserLinkBodies: the signing source is not held");
  }

  const pending = [...unique.values()].filter(
    ({ id }) => id !== sub.id && !linkedIds.has(id),
  );
  if (!pending.length && linkedIds.has(sub.id)) {
    return [];
  }

  // `sub` takes one slot in every batch.
  const perBody = MAX_LINK_SOURCES - 1;
  const batches: WalletSource[][] = [];
  for (let i = 0; i === 0 || i < pending.length; i += perBody) {
    batches.push([sub, ...pending.slice(i, i + perBody)]);
  }
  return batches;
};

/**
 * Signs one batch's consents under `iat`. Send the body with a JWT built from
 * the same clock reading, or every consent fails with 403. Nothing else is
 * checked here. The server rejects the whole request if any consent fails.
 */
export const signUserLinkBody = ({
  identity,
  signers,
  batch,
  iat,
}: {
  identity: SigningIdentity;
  signers: Map<string, Keypair>;
  batch: WalletSource[];
  iat: number;
}): UserLinkBody => ({
  sources: batch.map(({ id, kind }) => {
    const keypair =
      id === identity.sourceId ? identity.keypair : signers.get(id);
    if (!keypair) {
      throw new Error("buildUserLinkBodies: no signer for a source");
    }
    const message = buildLinkConsentMessage({
      id,
      kind,
      signingSourceId: identity.sourceId,
      iat,
    });
    return { id, kind, sig: signLinkConsent({ keypair, message }) };
  }),
});

/** Every batch signed under one iat. */
export const buildUserLinkBodies = ({
  identity,
  sources,
  signers,
  linkedIds,
  iat,
}: {
  identity: SigningIdentity;
  sources: WalletSource[];
  signers: Map<string, Keypair>;
  linkedIds?: ReadonlySet<string>;
  iat: number;
}): UserLinkBody[] =>
  batchUserLinkSources({ identity, sources, linkedIds }).map((batch) =>
    signUserLinkBody({ identity, signers, batch, iat }),
  );

/**
 * Resolves the pinned signer and the held sources, then groups the unsettled
 * ones into batches. Null when the session holds no signer (locked, or
 * nothing held), the same as getSigningIdentity.
 *
 * Also null when the signer is not the stored pin. getSigningIdentity falls
 * back to the first held source when the pin did not derive this unlock, and
 * signs with no pin at all if its pin write failed. That fallback is fine for
 * a request the server forgets, but a link is permanent: the server never
 * moves a claimed source or changes a user's canonical source, so a pass
 * under the wrong signer files every held source under the wrong user for
 * good. Skip the pass instead; the next trigger (an unlock, an add) retries.
 *
 * Nothing is signed yet. Sign each batch (signUserLinkBody) right before its
 * call, under the iat of the clock reading its JWT is built from
 * (buildAuthJwt({ now })). A JWT lives 15 seconds, so one iat shared by every
 * batch would expire while an earlier call is still out. A retry that mints a
 * new JWT, such as attachAuth's 401 retry, must re-sign the same way.
 */
export const buildUserLinkRequest = async ({
  linkedIds,
}: {
  linkedIds?: ReadonlySet<string>;
} = {}): Promise<{
  identity: SigningIdentity;
  signers: Map<string, Keypair>;
  batches: WalletSource[][];
} | null> => {
  const identity = await getSigningIdentity();
  if (!identity) {
    return null;
  }
  // Read after getSigningIdentity, which writes the pin when none is set.
  if (identity.sourceId !== (await getPinnedSourceId())) {
    return null;
  }
  const { sources, signers } = await getWalletSources();
  // A lock (or a key change) can land while getSigningIdentity awaits the
  // pin, so this read may no longer hold the signer it chose. That is the
  // no-signer case, not a caller bug: return null rather than throw.
  if (!sources.some(({ id }) => id === identity.sourceId)) {
    return null;
  }
  return {
    identity,
    signers,
    batches: batchUserLinkSources({ identity, sources, linkedIds }),
  };
};
