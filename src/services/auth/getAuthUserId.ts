import { getAuthKeypair } from "services/auth/getAuthKeypair";

/**
 * Public auth user id (hex) for analytics; null when the session is locked.
 * Only the public key hex is ever returned — the underlying keypair (and any
 * private key material) never leaves `getAuthKeypair`.
 */
export const getAuthUserId = async (): Promise<string | null> => {
  const keypair = await getAuthKeypair();
  return keypair ? keypair.rawPublicKey().toString("hex") : null;
};
