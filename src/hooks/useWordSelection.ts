import { useMemo, useState } from "react";

export const useWordSelection = (recoveryPhrase: string) => {
  const words = useMemo(() => recoveryPhrase.split(" "), [recoveryPhrase]);

  const [selectedIndexes] = useState(() => {
    const indexes = Array.from({ length: words.length }, (_, i) => i);
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return indexes.slice(0, 3);
  });

  return { words, selectedIndexes };
};
