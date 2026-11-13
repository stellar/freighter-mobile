import {
  getNextDefaultAccountName,
  normalizeAccountName,
} from "helpers/accountName";

const formatName = (number: number) => `Account ${number}`;

describe("getNextDefaultAccountName", () => {
  it("starts at Account 1 in an empty wallet", () => {
    expect(getNextDefaultAccountName([], formatName)).toBe("Account 1");
  });

  it("counts every account in the wallet", () => {
    expect(
      getNextDefaultAccountName(["Account 1", "Savings"], formatName),
    ).toBe("Account 3");
  });

  it("skips names already in use", () => {
    expect(
      getNextDefaultAccountName(["Account 3", "Account 4"], formatName),
    ).toBe("Account 5");
  });

  it("stops when the format ignores the number", () => {
    expect(getNextDefaultAccountName(["Account"], () => "Account")).toBe(
      "Account",
    );
  });
});

describe("normalizeAccountName", () => {
  it("trims and caps the name", () => {
    expect(normalizeAccountName("  Savings  ")).toBe("Savings");
    expect(normalizeAccountName("x".repeat(30))).toBe("x".repeat(24));
  });

  it("returns null for an empty or missing name", () => {
    expect(normalizeAccountName("   ")).toBeNull();
    expect(normalizeAccountName(undefined)).toBeNull();
  });
});
