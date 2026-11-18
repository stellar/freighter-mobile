import StellarHDWallet from "stellar-hd-wallet";

export const normalizeRecoveryPhrase = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/\s+/g, " ");

export const normalizeAndTrimRecoveryPhrase = (text: string): string =>
  normalizeRecoveryPhrase(text).replace(/\n/g, " ").trim();

/**
 * True when the phrase, once normalized, is 12 or 24 words and passes the
 * BIP-39 English wordlist and checksum. Lighter than deriving the wallet, so
 * a screen can check it on submit without blocking the JS thread.
 */
export const isValidImportMnemonic = (text: string): boolean => {
  const normalized = normalizeAndTrimRecoveryPhrase(text);
  const wordCount = normalized === "" ? 0 : normalized.split(" ").length;
  if (wordCount !== 12 && wordCount !== 24) {
    return false;
  }
  return StellarHDWallet.validateMnemonic(normalized);
};
