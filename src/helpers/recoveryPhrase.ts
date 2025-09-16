export const normalizeRecoveryPhrase = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/\s+/g, " ");

export const normalizeAndTrimRecoveryPhrase = (text: string): string =>
  normalizeRecoveryPhrase(text).replace(/\n/g, " ").trim();
