import { Keypair } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import {
  MnemonicMap,
  SecretSource,
  SecretSourceMap,
  SecretSourceType,
} from "config/types";
import {
  deriveAuthKeypair,
  deriveSourceIdentity,
} from "services/auth/deriveAuthKeypair";
import { dataStorage } from "services/storage/storageFactory";

/*
  The set of secret sources a wallet holds (every seed phrase and every
  standalone secret key), persisted in PLAIN storage beside `accountList`.
  Nothing here is secret: a source id is a derived public key that is not
  linkable to a G address, and the label and timestamp exist only for the UI.
  Keeping it in plain storage is what lets an install-time migration read it
  with no password.

  The pinned source id lives beside the set. It is the first source the wallet
  registered, it signs every backend request (see getSigningIdentity), and it
  survives lock. Both are cleared with the rest of the
  non-sensitive keys on wipe (clearNonSensitiveData walks STORAGE_KEYS).

  Labels are stored as records, not rendered copy: `nextLabel` parses the
  stored label to allocate the next number, so the prefix must not vary with
  the device locale. They mirror the extension's values byte for byte.
*/

const LABEL_PREFIX: Record<SecretSourceType, string> = {
  [SecretSourceType.PHRASE]: "Seed Phrase",
  [SecretSourceType.SECRET_KEY]: "Secret Key",
};

/** The phrase source id. Returns only the id; the signing keypair stays with the auth layer. */
export const getPhraseSourceId = async (mnemonic: string): Promise<string> =>
  (await deriveAuthKeypair(mnemonic)).userId;

/** The secret-key source id, from the key's raw 32-byte ed25519 seed. */
export const getSecretKeySourceId = async (
  secretKey: string,
): Promise<string> =>
  (await deriveSourceIdentity(Keypair.fromSecret(secretKey).rawSecretKey()))
    .sourceId;

export const getSecretSources = async (): Promise<SecretSourceMap> => {
  const raw = await dataStorage.getItem(STORAGE_KEYS.SECRET_SOURCES);

  return raw ? (JSON.parse(raw) as SecretSourceMap) : {};
};

/**
 * Allocates the next label number for `type`: one past the highest number
 * already used by that type, so a label is never reused after a removal.
 */
const nextLabel = (sources: SecretSourceMap, type: SecretSourceType) => {
  const prefix = LABEL_PREFIX[type];
  const pattern = new RegExp(`^${prefix} (\\d+)$`);
  let highest = 0;

  Object.values(sources).forEach((source) => {
    if (source.type !== type) {
      return;
    }
    const match = pattern.exec(source.label);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  });

  return `${prefix} ${highest + 1}`;
};

export const getPinnedSourceId = async (): Promise<string | null> =>
  (await dataStorage.getItem(STORAGE_KEYS.PINNED_SOURCE_ID)) || null;

export const setPinnedSourceId = async (sourceId: string): Promise<void> => {
  await dataStorage.setItem(STORAGE_KEYS.PINNED_SOURCE_ID, sourceId);
};

export const clearPinnedSourceId = async (): Promise<void> => {
  await dataStorage.remove(STORAGE_KEYS.PINNED_SOURCE_ID);
};

/**
 * The wallet's first source: the earliest record in the persisted set, or
 * null when nothing is registered. Reads only; pinFirstSource writes it.
 */
export const getFirstSourceId = async (): Promise<string | null> => {
  // Source ids are 64-char hex, never integer-like, so key order is
  // insertion order.
  const [first] = Object.keys(await getSecretSources());
  return first || null;
};

/**
 * Pins the wallet's first source when no pin is set and returns the pin.
 *
 * The first source is the earliest record in the persisted set, not whatever
 * the caller is registering now. The record and the pin are separate writes,
 * so this is what lets any later registration, or the next unlock, repair a
 * pin write that failed. Returns null when nothing is pinned and nothing is
 * registered.
 */
export const pinFirstSource = async (): Promise<string | null> => {
  const pinned = await getPinnedSourceId();
  if (pinned) {
    return pinned;
  }

  const first = await getFirstSourceId();
  if (!first) {
    return null;
  }

  await setPinnedSourceId(first);
  return first;
};

/**
 * Registers a source. Idempotent by id: an existing record is returned
 * untouched, so re-adding (a re-import, a recover with N preloaded accounts)
 * never allocates a second label.
 *
 * The first source a wallet registers becomes its pinned source, and the pin
 * never moves after that: a phrase wallet that later imports a key keeps the
 * phrase, and a key-first wallet keeps the key. The record is written first
 * and the pin is derived from the persisted set (see pinFirstSource), so a
 * failed write on either side is repaired by the next registration.
 */
export const addSecretSource = async ({
  id,
  type,
}: {
  id: string;
  type: SecretSourceType;
}): Promise<SecretSource> => {
  const sources = await getSecretSources();

  let source = sources[id];
  if (!source) {
    source = {
      id,
      type,
      label: nextLabel(sources, type),
      createdAt: Date.now(),
    };
    await dataStorage.setItem(
      STORAGE_KEYS.SECRET_SOURCES,
      JSON.stringify({ ...sources, [id]: source }),
    );
  }

  await pinFirstSource();

  return source;
};

export const clearSecretSources = async (): Promise<void> => {
  await dataStorage.remove(STORAGE_KEYS.SECRET_SOURCES);
};

/** The held mnemonic of one phrase source, or null when it is not held. */
export const getHeldMnemonic = ({
  mnemonics,
  sourceId,
}: {
  mnemonics: MnemonicMap;
  sourceId: string;
}): { sourceId: string; mnemonic: string } | null => {
  const mnemonic = mnemonics[sourceId];

  return mnemonic ? { sourceId, mnemonic } : null;
};

/**
 * INTERIM resolver for the callers that still assume "the" wallet phrase
 * (show recovery phrase, account creation, ...). Given the mnemonics the
 * unlocked session holds, it returns the pinned source's mnemonic when one is
 * pinned and held, else the first held phrase, else null. For a one-phrase
 * wallet this is exactly the phrase the single slot used to hold.
 *
 * Not an identity: backend auth and the analytics id resolve through
 * getSigningIdentity. Account creation names its source and falls back here
 * only when the caller names none and the active account has no held phrase.
 * A wallet with no phrase (secret-key only) resolves to null even though the
 * session is unlocked; that state cannot be onboarded on mobile yet.
 */
export const getDefaultMnemonic = async ({
  mnemonics,
}: {
  mnemonics: MnemonicMap;
}): Promise<{ sourceId: string; mnemonic: string } | null> => {
  const pinned = await getPinnedSourceId();

  if (pinned && mnemonics[pinned]) {
    return { sourceId: pinned, mnemonic: mnemonics[pinned] };
  }

  const [first] = Object.keys(mnemonics);

  return first ? { sourceId: first, mnemonic: mnemonics[first] } : null;
};
