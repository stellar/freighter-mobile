import { useMemo, useState } from "react";

export const useWordSelection = (recoveryPhrase: string) => {
  const words = useMemo(() => recoveryPhrase.split(" "), [recoveryPhrase]);

  const [selectedIndices] = useState(() => {
    const indices = Array.from({ length: words.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, 3);
  });

  return { words, selectedIndices };
};
