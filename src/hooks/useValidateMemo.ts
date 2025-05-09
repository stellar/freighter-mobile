import { Memo } from "@stellar/stellar-sdk";
import { MAX_MEMO_BYTES } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useEffect, useState } from "react";

/**
 * Calculates the byte length of a string
 * @param str The string to measure
 * @returns The length in bytes
 */
const getByteLength = (str: string): number =>
  new TextEncoder().encode(str).length;

/**
 * Hook to validate a transaction memo
 * Returns error message if invalid
 */
export const useValidateMemo = (memo: string) => {
  const { t } = useAppTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Memo is optional, so empty is valid
    if (!memo) {
      setError(null);
      return;
    }

    // Check byte length first (Stellar has a 28-byte limit for text memos)
    if (getByteLength(memo) > MAX_MEMO_BYTES) {
      setError(
        t("transactionMemoScreen.errors.tooLong", {
          max: String(MAX_MEMO_BYTES),
        }),
      );
      return;
    }

    try {
      // Then try creating a Stellar memo to validate
      Memo.text(memo);

      setError(null);
    } catch (err) {
      setError(t("transactionMemoScreen.errors.invalid"));
    }
  }, [memo, t]);

  return { error };
};
