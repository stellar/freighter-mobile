import {
  buildRoundOptions,
  generateUniqueDecoyWords,
} from "helpers/recoveryPhraseValidation";
import { useMemo, useState, useCallback } from "react";

interface WordSelectionResult {
  words: string[];
  selectedIndexes: number[];
  generateWordOptionsForRound: (roundIndex: number) => string[];
}

/**
 * Generate 9 selectable words for each validation round (2 user extras + 6 decoys + 1 correct).
 * Decoys are sourced from a random mnemonic (excluding all user words)
 * and we build the final list using `buildRoundOptions`.
 */
export const useWordSelection = (
  recoveryPhrase: string,
): WordSelectionResult => {
  const words = useMemo(() => recoveryPhrase.split(" "), [recoveryPhrase]);

  const [selectedIndexes] = useState(() => {
    const indexes = Array.from({ length: words.length }, (_, i) => i);

    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }

    return indexes.slice(0, 3);
  });

  /**
   * Build the 9 options for the given round index.
   */
  const generateWordOptionsForRound = useCallback(
    (roundIndex: number): string[] => {
      if (roundIndex >= selectedIndexes.length) {
        return [];
      }

      const currentWordIndex = selectedIndexes[roundIndex];
      const correctWord = words[currentWordIndex];

      const decoyWords: string[] = generateUniqueDecoyWords({
        forbiddenWords: [...words, correctWord],
      });

      return buildRoundOptions({
        correctWord,
        userWords: words,
        decoyWords,
      });
    },
    [words, selectedIndexes],
  );

  return {
    words,
    selectedIndexes,
    generateWordOptionsForRound,
  };
};
