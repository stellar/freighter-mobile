import { sanitizePastedAmount } from "helpers/formatAmount";

// US locale: decimal ".", grouping ",". EU locale: decimal ",", grouping ".".
// (Only the decimal separator is needed — the other char is grouping.)
const US = { decimalSeparator: ".", maxDecimals: 7 };
const EU = { decimalSeparator: ",", maxDecimals: 7 };
const US_FIAT = { decimalSeparator: ".", maxDecimals: 2 };

describe("sanitizePastedAmount", () => {
  describe("plain + typed-progress input is preserved (US)", () => {
    it("returns '' for empty input (a clear, not a reject)", () => {
      expect(sanitizePastedAmount("", US)).toBe("");
    });

    it("keeps a plain integer", () => {
      expect(sanitizePastedAmount("1234", US)).toBe("1234");
    });

    it("keeps a plain decimal", () => {
      expect(sanitizePastedAmount("1.5", US)).toBe("1.5");
    });

    it("preserves a trailing decimal separator (mid-typing)", () => {
      expect(sanitizePastedAmount("1.", US)).toBe("1.");
    });

    it("preserves a trailing zero in the fraction (mid-typing)", () => {
      expect(sanitizePastedAmount("1.50", US)).toBe("1.50");
    });

    it("prepends a leading zero for a bare-leading-separator fraction", () => {
      expect(sanitizePastedAmount(".5", US)).toBe("0.5");
    });

    it("normalizes a bare separator to '0.'", () => {
      expect(sanitizePastedAmount(".", US)).toBe("0.");
    });

    it("strips leading zeros from the integer part", () => {
      expect(sanitizePastedAmount("0001234", US)).toBe("1234");
    });

    it("keeps a single zero", () => {
      expect(sanitizePastedAmount("0", US)).toBe("0");
    });
  });

  describe("grouping separators (US)", () => {
    it("treats a lone grouping separator as grouping → integer", () => {
      expect(sanitizePastedAmount("1,234", US)).toBe("1234");
    });

    it("treats multiple grouping separators as grouping → integer", () => {
      expect(sanitizePastedAmount("1,234,567", US)).toBe("1234567");
    });
  });

  describe("mixed grouping + decimal — rightmost separator is the decimal", () => {
    it("parses US-formatted '1,234.56' → '1234.56'", () => {
      expect(sanitizePastedAmount("1,234.56", US)).toBe("1234.56");
    });

    it("parses US-formatted '1,234,567.89' → '1234567.89'", () => {
      expect(sanitizePastedAmount("1,234,567.89", US)).toBe("1234567.89");
    });

    it("parses EU-formatted '1.234,56' on a US device → '1234.56' (rightmost wins)", () => {
      expect(sanitizePastedAmount("1.234,56", US)).toBe("1234.56");
    });
  });

  describe("locale-aware output (EU: decimal ',', grouping '.')", () => {
    it("keeps a lone EU decimal comma", () => {
      expect(sanitizePastedAmount("1,5", EU)).toBe("1,5");
    });

    it("treats a lone EU grouping dot as grouping → integer", () => {
      expect(sanitizePastedAmount("1.234", EU)).toBe("1234");
    });

    it("treats multiple EU grouping dots as grouping → integer", () => {
      expect(sanitizePastedAmount("1.234.567", EU)).toBe("1234567");
    });

    it("parses EU-formatted '1.234,56' → '1234,56' (decimal emitted in locale form)", () => {
      expect(sanitizePastedAmount("1.234,56", EU)).toBe("1234,56");
    });

    it("parses US-formatted '1,234.56' on an EU device → '1234,56' (rightmost wins, locale decimal out)", () => {
      expect(sanitizePastedAmount("1,234.56", EU)).toBe("1234,56");
    });
  });

  describe("group-width validation (a lone non-locale separator)", () => {
    it("treats a valid 3-digit group as grouping (1,234 → 1234)", () => {
      expect(sanitizePastedAmount("1,234", US)).toBe("1234");
    });

    it("reads an invalid-width lone comma on US as a foreign decimal (5,2 → 5.2)", () => {
      expect(sanitizePastedAmount("5,2", US)).toBe("5.2");
    });

    it("reads a 2-digit-tail lone comma on US as a foreign decimal (12,34 → 12.34)", () => {
      expect(sanitizePastedAmount("12,34", US)).toBe("12.34");
    });

    it("reads an invalid-width lone dot on EU as a foreign decimal (5.2 → 5,2)", () => {
      expect(sanitizePastedAmount("5.2", EU)).toBe("5,2");
    });

    it("reads a tiny US decimal on EU as a decimal, not 100,000x grouping (0.00001 → 0,00001)", () => {
      expect(sanitizePastedAmount("0.00001", EU)).toBe("0,00001");
    });

    it("rescues a US-grouped integer pasted on EU (1,234,567 → 1234567)", () => {
      expect(sanitizePastedAmount("1,234,567", EU)).toBe("1234567");
    });

    it("rejects irregular repeated grouping (1,2,3 → reject)", () => {
      expect(sanitizePastedAmount("1,2,3", US)).toBeNull();
    });
  });

  describe("garbage stripping", () => {
    it("strips a trailing currency code", () => {
      expect(sanitizePastedAmount("1234.56 XLM", US)).toBe("1234.56");
    });

    it("strips a leading currency symbol and grouping", () => {
      expect(sanitizePastedAmount("$1,234.56", US)).toBe("1234.56");
    });

    it("strips a leading minus sign (amounts are non-negative)", () => {
      expect(sanitizePastedAmount("-5", US)).toBe("5");
    });

    it("strips embedded whitespace grouping", () => {
      expect(sanitizePastedAmount("1 234,56", EU)).toBe("1234,56");
    });
  });

  describe("decimal truncation (truncate, never round)", () => {
    it("truncates a token fraction beyond maxDecimals", () => {
      expect(sanitizePastedAmount("1.123456789", US)).toBe("1.1234567");
    });

    it("truncates a fiat fraction beyond 2 decimals without rounding", () => {
      expect(sanitizePastedAmount("1.999", US_FIAT)).toBe("1.99");
    });
  });

  describe("trailing separators (adversarial)", () => {
    it("treats a trailing grouping separator as junk, not the decimal", () => {
      // Rightmost-is-decimal must NOT pick a trailing separator (no digits
      // after it) as the decimal — that turned "1.5," into "15." (10x).
      expect(sanitizePastedAmount("1.5,", US)).toBe("1.5");
    });

    it("strips multiple trailing separators", () => {
      expect(sanitizePastedAmount("1.5,,", US)).toBe("1.5");
    });

    it("still preserves a lone trailing locale decimal (typed progress)", () => {
      expect(sanitizePastedAmount("1.", US)).toBe("1.");
      expect(sanitizePastedAmount("100,", EU)).toBe("100,");
    });
  });

  describe("unicode normalization (adversarial)", () => {
    it("normalizes fullwidth digits and separator (NFKC)", () => {
      expect(sanitizePastedAmount("１２３４．５６", US)).toBe("1234.56");
    });

    it("normalizes fullwidth digits with a fullwidth grouping comma", () => {
      expect(sanitizePastedAmount("１，２３４．５６", US)).toBe("1234.56");
    });
  });

  describe("integer-only tokens (maxDecimals 0)", () => {
    const US_INT = { decimalSeparator: ".", maxDecimals: 0 };

    it("drops a fraction for a 0-decimal token (no trailing dot)", () => {
      expect(sanitizePastedAmount("42.1", US_INT)).toBe("42");
    });

    it("drops a bare trailing separator for a 0-decimal token", () => {
      expect(sanitizePastedAmount("42.", US_INT)).toBe("42");
    });
  });

  describe("rejects (returns null → caller rolls back + toasts)", () => {
    it("rejects mixed input whose integer portion isn't validly grouped (0.5,1)", () => {
      expect(sanitizePastedAmount("0.5,1", US)).toBeNull();
    });

    it("rejects irregular mixed grouping such as Indian lakh (1,23,456.78)", () => {
      expect(sanitizePastedAmount("1,23,456.78", US)).toBeNull();
    });

    it("rejects all-garbage input with no digits", () => {
      expect(sanitizePastedAmount("abc", US)).toBeNull();
    });

    it("rejects a lone non-numeric symbol", () => {
      expect(sanitizePastedAmount("$", US)).toBeNull();
    });

    it("rejects two decimal separators of the locale decimal", () => {
      expect(sanitizePastedAmount("1.2.3", US)).toBeNull();
    });

    it("rejects a doubled decimal separator", () => {
      expect(sanitizePastedAmount("1..2", US)).toBeNull();
    });

    it("rejects when more than one decimal survives grouping removal", () => {
      expect(sanitizePastedAmount("1,2.3.4", US)).toBeNull();
    });

    it("rejects scientific notation (positive exponent)", () => {
      expect(sanitizePastedAmount("1e5", US)).toBeNull();
    });

    it("rejects scientific notation (negative exponent)", () => {
      expect(sanitizePastedAmount("1.5e-3", US)).toBeNull();
    });

    it("rejects a huge scientific-notation magnitude", () => {
      expect(sanitizePastedAmount("1e999", US)).toBeNull();
    });
  });
});
