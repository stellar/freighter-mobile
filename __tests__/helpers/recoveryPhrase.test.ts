import {
  normalizeRecoveryPhrase,
  normalizeAndTrimRecoveryPhrase,
} from "helpers/recoveryPhrase";

describe("recoveryPhrase helpers", () => {
  describe("normalizeRecoveryPhrase", () => {
    it("should convert uppercase to lowercase", () => {
      const input =
        "ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT";
      const expected =
        "abandon ability able about above absent absorb abstract absurd abuse access accident";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should normalize multiple spaces to single spaces", () => {
      const input = "abandon  ability   able    about     above";
      const expected = "abandon ability able about above";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should remove diacritical marks from accented characters", () => {
      const input = "abandón abilité ablé aboút abové";
      const expected = "abandon abilite able about above";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle mixed case with accents and spacing", () => {
      const input = "AbAndÓn  ABILITÉ   ablé    ABOÚT     abové";
      const expected = "abandon abilite able about above";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should convert line breaks to spaces", () => {
      const input = "abandon ability\nable about\nabove absent";
      const expected = "abandon ability able about above absent";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle various Unicode diacritical marks", () => {
      const input = "àbándön ábílítÿ áblé ábôút âbövé";
      const expected = "abandon ability able about above";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle tabs and mixed whitespace", () => {
      const input = "abandon\tability\t\table\t \tabout";
      const expected = "abandon ability able about";
      expect(normalizeRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle empty string", () => {
      expect(normalizeRecoveryPhrase("")).toBe("");
    });

    it("should handle single word", () => {
      expect(normalizeRecoveryPhrase("ABANDÓN")).toBe("abandon");
    });
  });

  describe("normalizeAndTrimRecoveryPhrase", () => {
    it("should convert line breaks to spaces and trim", () => {
      const input = "\n abandon ability\nable about\nabove absent \n";
      const expected = "abandon ability able about above absent";
      expect(normalizeAndTrimRecoveryPhrase(input)).toBe(expected);
    });

    it("should trim leading and trailing whitespace", () => {
      const input = "   abandon ability able about above absent   ";
      const expected = "abandon ability able about above absent";
      expect(normalizeAndTrimRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle multiple line breaks", () => {
      const input = "abandon\n\nability\n\n\nable\nabout";
      const expected = "abandon ability able about";
      expect(normalizeAndTrimRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle carriage returns and line feeds", () => {
      const input = "abandon\r\nability\rable\nabout";
      const expected = "abandon ability able about";
      expect(normalizeAndTrimRecoveryPhrase(input)).toBe(expected);
    });

    it("should combine all normalizations", () => {
      const input = "\n  ABANDÓN  ABILITÉ\n\n  ABLÉ\tABOÚT     ABOVÉ  \n";
      const expected = "abandon abilite able about above";
      expect(normalizeAndTrimRecoveryPhrase(input)).toBe(expected);
    });

    it("should handle empty string", () => {
      expect(normalizeAndTrimRecoveryPhrase("")).toBe("");
    });

    it("should handle only whitespace and line breaks", () => {
      expect(normalizeAndTrimRecoveryPhrase("\n  \t\n  \n")).toBe("");
    });
  });
});
