import { StrKey } from "@stellar/stellar-sdk";
import {
  isValidImportMnemonic,
  normalizeAndTrimRecoveryPhrase,
} from "helpers/recoveryPhrase";

export type ParsedImportSecret =
  | { type: "phrase"; mnemonicPhrase: string }
  | { type: "secret_key"; secretKey: string }
  | { type: "invalid" };

/**
 * Classifies what Import Wallet was given: a Stellar secret key, a 12 or
 * 24-word recovery phrase, or neither. The secret key is checked first and
 * keeps its case; a phrase comes back normalized.
 */
export const parseImportSecret = (input: string): ParsedImportSecret => {
  const trimmed = input.trim();
  if (StrKey.isValidEd25519SecretSeed(trimmed)) {
    return { type: "secret_key", secretKey: trimmed };
  }
  if (isValidImportMnemonic(input)) {
    return {
      type: "phrase",
      mnemonicPhrase: normalizeAndTrimRecoveryPhrase(input),
    };
  }
  return { type: "invalid" };
};
