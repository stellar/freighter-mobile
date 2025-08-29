import {
  VALIDATION_DECOY_WORDS,
  VALIDATION_EXTRA_USER_WORDS,
} from "config/constants";
import StellarHDWallet from "stellar-hd-wallet";

export interface BuildRoundOptionsParams {
  correctWord: string;
  userWords: string[];
  decoyWords: string[];
}

/**
 * Fisher–Yates shuffle. Returns a new shuffled array.
 *
 * reference:https://dev.to/tanvir_azad/fisher-yates-shuffle-the-right-way-to-randomize-an-array-4d2p
 */
export const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Build the final 9-option list for a round.
 * - Picks `VALIDATION_EXTRA_USER_WORDS` words from the user's mnemonic (excluding the correct word)
 * - Takes exactly `decoyCount` decoys from the provided pool
 * - Appends the correct word and shuffles the combined list
 *
 * @params {BuildRoundOptionsParams} params - The parameters for building the round options
 * @returns {string[]} Shuffled array with 9 unique options (2 user extras, 6 decoys, 1 correct)
 */
export const buildRoundOptions = (
  params: BuildRoundOptionsParams,
): string[] => {
  const { correctWord, userWords, decoyWords } = params;

  const candidateUserWords = userWords.filter((w) => w !== correctWord);
  const shuffledCandidateUserWords = shuffle(candidateUserWords);
  const extraUserWords = shuffledCandidateUserWords.slice(
    0,
    VALIDATION_EXTRA_USER_WORDS,
  );
  const decoys = decoyWords.slice(0, VALIDATION_DECOY_WORDS);
  const combined = [...decoys, ...extraUserWords, correctWord];

  return shuffle(combined);
};

export interface GenerateDecoyWordsParams {
  forbiddenWords: string[];
}

/**
 * Generates a list of unique decoy words not present in forbiddenWords.
 * Uses a Set and iteratively samples BIP39 mnemonics until the required size is reached.
 */
export const generateUniqueDecoyWords = (
  params: GenerateDecoyWordsParams,
): string[] => {
  const { forbiddenWords } = params;

  const usedWords = new Set<string>(forbiddenWords);
  const decoyWords: string[] = [];

  while (decoyWords.length < VALIDATION_DECOY_WORDS) {
    const mnemonic = StellarHDWallet.generateMnemonic({ entropyBits: 128 });
    const pool = mnemonic.split(" ");

    for (
      let i = 0;
      i < pool.length && decoyWords.length < VALIDATION_DECOY_WORDS;
      i++
    ) {
      const candidate = pool[i];

      if (!usedWords.has(candidate)) {
        decoyWords.push(candidate);
        usedWords.add(candidate); // Add to used words to avoid duplicates
      }
    }
  }

  return decoyWords.slice(0, VALIDATION_DECOY_WORDS);
};
