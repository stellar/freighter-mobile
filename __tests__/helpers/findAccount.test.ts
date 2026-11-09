import { Account } from "config/types";
import { findAccountById, findAccountByPublicKey } from "helpers/findAccount";

jest.mock("i18next", () => ({
  t: (key: string) => key,
}));

const ACCOUNTS: Account[] = [
  { id: "0.11", sourceId: "phrase-1", publicKey: "GA", name: "A" },
  {
    id: "0.22",
    sourceId: "key-1",
    publicKey: "GB",
    name: "B",
    importedFromSecretKey: true,
  },
  // The same key imported twice: two keystores, one public key.
  {
    id: "0.33",
    sourceId: "key-1",
    publicKey: "GB",
    name: "C",
    importedFromSecretKey: true,
  },
];

describe("findAccountByPublicKey", () => {
  it("returns the account with that public key", () => {
    expect(findAccountByPublicKey(ACCOUNTS, "GA")).toBe(ACCOUNTS[0]);
  });

  it("returns the first match when two accounts share a public key", () => {
    expect(findAccountByPublicKey(ACCOUNTS, "GB")).toBe(ACCOUNTS[1]);
  });

  it("throws for an unknown public key instead of falling back", () => {
    expect(() => findAccountByPublicKey(ACCOUNTS, "GZ")).toThrow(
      "authStore.error.accountNotFound",
    );
  });

  it("throws when the matched account has no id", () => {
    const legacy = [{ publicKey: "GA", name: "A" }] as Account[];
    expect(() => findAccountByPublicKey(legacy, "GA")).toThrow(
      "authStore.error.accountNotFound",
    );
  });
});

describe("findAccountById", () => {
  it("returns the account with that id", () => {
    expect(findAccountById(ACCOUNTS, "0.33")).toBe(ACCOUNTS[2]);
  });

  it("throws for an unknown id instead of falling back", () => {
    expect(() => findAccountById(ACCOUNTS, "0.99")).toThrow(
      "authStore.error.accountNotFound",
    );
  });
});
