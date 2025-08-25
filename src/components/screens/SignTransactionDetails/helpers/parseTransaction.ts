import { Memo, MemoType } from "@stellar/stellar-sdk";
import buffer from "buffer";

export const decodeMemo = (
  memo: unknown,
): { value: string; type: MemoType } => {
  const decodedMemo = memo as Memo;

  if (decodedMemo.type === "id") {
    return { value: decodedMemo.value as string, type: decodedMemo.type };
  }

  const decodeMethod = ["hash", "return"].includes(decodedMemo.type)
    ? "hex"
    : "utf-8";

  return {
    value: decodedMemo.value
      ? // NOTE:
        // Can also be an ArrayBufferLike but the memo type doesn't make it easy for buffer to accept it without narrowing.
        buffer.Buffer.from(decodedMemo.value as string).toString(decodeMethod)
      : "",
    type: decodedMemo.type,
  };
};
