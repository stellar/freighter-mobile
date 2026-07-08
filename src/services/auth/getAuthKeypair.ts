import { Keypair } from "@stellar/stellar-sdk";
import { getActiveMnemonicPhrase, isSessionAuthValid } from "ducks/auth";
import {
  getCachedAuthKeypair,
  setCachedAuthKeypair,
} from "services/auth/authKeypairCache";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

export { clearAuthKeypairCache } from "services/auth/authKeypairCache";

export const getAuthKeypair = async (): Promise<Keypair | null> => {
  if (!(await isSessionAuthValid())) return null; // AUTHENTICATED + hash key present & not expired (cheap)
  const cached = getCachedAuthKeypair();
  if (cached) return cached;
  const mnemonic = await getActiveMnemonicPhrase();
  if (!mnemonic) return null;
  const { keypair } = deriveAuthKeypair(mnemonic);
  setCachedAuthKeypair(keypair);
  return keypair;
};
