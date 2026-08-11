import { decodeDataValue } from "helpers/history/v2/decodeDataValue";

const b64 = (input: string | number[]): string => {
  if (typeof input === "string") {
    return Buffer.from(input).toString("base64");
  }
  return Buffer.from(Uint8Array.from(input)).toString("base64");
};

describe("decodeDataValue", () => {
  it("returns null for a null input", () => {
    expect(decodeDataValue(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decodeDataValue("")).toBeNull();
  });

  it("decodes plain ASCII", () => {
    expect(decodeDataValue(b64("hello"))).toBe("hello");
  });

  it("decodes multi-byte UTF-8 rather than mojibake", () => {
    expect(decodeDataValue(b64("café"))).toBe("café");
    expect(decodeDataValue(b64("日本語"))).toBe("日本語");
  });

  it("preserves the whitespace control characters", () => {
    expect(decodeDataValue(b64("a\tb\nc\rd"))).toBe("a\tb\nc\rd");
  });

  it("falls back to base64 for invalid UTF-8", () => {
    // This path exercises the round-trip byte comparison rejection.
    const input = b64([0xff, 0xfe, 0xfd]);
    expect(decodeDataValue(input)).toBe(input);
  });

  it("falls back to base64 for ASCII control characters", () => {
    // 0x00 0x01 is valid UTF-8 but not printable
    const input = b64([0x00, 0x01]);
    expect(decodeDataValue(input)).toBe(input);
  });

  it("falls back to base64 for DEL and the C1 range", () => {
    // DEL (0x7F) is valid ASCII, so it survives the round trip and is caught
    // by the printability check.
    expect(decodeDataValue(b64([0x7f]))).toBe(b64([0x7f]));

    // U+0080 encoded as valid UTF-8 (0xC2 0x80). It must reach hasControlChars
    // rather than being rejected as invalid UTF-8 — that path is case 6's job.
    const c1 = b64([0xc2, 0x80]);
    expect(decodeDataValue(c1)).toBe(c1);
  });

  it("does not treat a legitimate U+FFFD as a decode failure", () => {
    // A real replacement character in valid UTF-8 must survive — this is why
    // the check is a round trip and not a scan for U+FFFD.
    expect(decodeDataValue(b64("a�b"))).toBe("a�b");
  });

  it("falls back to base64 for malformed base64", () => {
    expect(decodeDataValue("!!!not-base64!!!")).toBe("!!!not-base64!!!");
  });
});
