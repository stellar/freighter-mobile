import { parseImportSecret } from "helpers/parseImportSecret";

const PHRASE_12 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PHRASE_24 = `${"abandon ".repeat(23)}art`;
const SECRET_KEY = "SBUV3MRWKNS6AYKZ6E6MOUVF2OYMON3MIUASWL3JLY5E3ISDJFELYBRZ";

describe("parseImportSecret", () => {
  it("reads a secret key, trimmed, with its case intact", () => {
    expect(parseImportSecret(`  ${SECRET_KEY}\n`)).toEqual({
      type: "secret_key",
      secretKey: SECRET_KEY,
    });
  });

  it("rejects a lowercased secret key", () => {
    expect(parseImportSecret(SECRET_KEY.toLowerCase())).toEqual({
      type: "invalid",
    });
  });

  it("rejects a secret key with a bad checksum", () => {
    expect(parseImportSecret(`${SECRET_KEY.slice(0, -1)}A`)).toEqual({
      type: "invalid",
    });
  });

  it("rejects a public key", () => {
    expect(
      parseImportSecret(
        "GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX",
      ),
    ).toEqual({ type: "invalid" });
  });

  it.each([
    ["12", PHRASE_12],
    ["24", PHRASE_24],
  ])("reads a %s-word phrase", (_count, phrase) => {
    expect(parseImportSecret(phrase)).toEqual({
      type: "phrase",
      mnemonicPhrase: phrase,
    });
  });

  it("normalizes a phrase's case and spacing", () => {
    expect(
      parseImportSecret(`  ${PHRASE_12.toUpperCase().replace(/ /g, "   ")}\n`),
    ).toEqual({ type: "phrase", mnemonicPhrase: PHRASE_12 });
  });

  it("rejects a phrase with a bad checksum", () => {
    expect(parseImportSecret(PHRASE_12.replace(/about$/, "abandon"))).toEqual({
      type: "invalid",
    });
  });

  it("rejects a phrase of the wrong length", () => {
    expect(parseImportSecret("abandon ".repeat(14).trim())).toEqual({
      type: "invalid",
    });
  });

  it.each(["", "   ", "hello"])("rejects %p", (input) => {
    expect(parseImportSecret(input)).toEqual({ type: "invalid" });
  });
});
