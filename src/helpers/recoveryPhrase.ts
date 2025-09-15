export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/\s+/g, " ");

export const normalizeAndTrimText = (text: string): string =>
  normalizeText(text).trim().replace(/\n/g, " ");
