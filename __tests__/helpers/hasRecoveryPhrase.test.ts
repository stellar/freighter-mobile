import { SecretSource, SecretSourceType } from "config/types";
import { hasRecoveryPhrase } from "helpers/hasRecoveryPhrase";

const source = (type: SecretSourceType, id: string): SecretSource => ({
  id,
  type,
  label: type === SecretSourceType.PHRASE ? "Seed Phrase 1" : "Secret Key 1",
  createdAt: 1,
});

describe("hasRecoveryPhrase", () => {
  it("is false for a wallet holding only secret keys", () => {
    expect(
      hasRecoveryPhrase([
        source(SecretSourceType.SECRET_KEY, "a"),
        source(SecretSourceType.SECRET_KEY, "b"),
      ]),
    ).toBe(false);
  });

  it("is true once the wallet holds a phrase", () => {
    expect(
      hasRecoveryPhrase([
        source(SecretSourceType.SECRET_KEY, "a"),
        source(SecretSourceType.PHRASE, "b"),
      ]),
    ).toBe(true);
  });

  // No sources yet (not loaded, or a wallet from before source records)
  // must not hide a phrase the wallet may hold.
  it("is true when there are no sources", () => {
    expect(hasRecoveryPhrase([])).toBe(true);
  });
});
