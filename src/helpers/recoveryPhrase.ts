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
 * Normalizes typed or pasted text for a field that may hold either a phrase
 * or a secret key. Only spacing is collapsed: a secret key is case-sensitive,
 * so it must not be lowercased the way a phrase is. Trimmed when `trim`.
 */
export const normalizeImportSecretInput = (
  text: string,
  { trim = false }: { trim?: boolean } = {},
): string => {
  const collapsed = text.replace(/\s+/g, " ");
  return trim ? collapsed.trim() : collapsed;
};

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
