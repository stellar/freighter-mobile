import { Account, SecretSource, SecretSourceType } from "config/types";
import {
  AccountGroupKind,
  getSourceLabel,
  groupAccountsBySource,
} from "helpers/accountGroups";
import { TFunction } from "i18next";

const t = ((key: string, options?: { number?: string }) =>
  options?.number
    ? `${key}:${options.number}`
    : key) as TFunction<"translations">;

const phrase = (
  id: string,
  label: string,
  createdAt: number,
): SecretSource => ({
  id,
  type: SecretSourceType.PHRASE,
  label,
  createdAt,
});
const secretKey = (
  id: string,
  label: string,
  createdAt: number,
): SecretSource => ({
  id,
  type: SecretSourceType.SECRET_KEY,
  label,
  createdAt,
});
const account = (id: string, sourceId?: string): Account => ({
  id,
  sourceId,
  name: id,
  publicKey: `G${id}`,
});

describe("getSourceLabel", () => {
  it("keeps the stored number and translates the rest", () => {
    expect(getSourceLabel(phrase("p", "Seed Phrase 2", 0), t)).toBe(
      "accountsRecoveryScreen.recoveryPhraseLabel:2",
    );
    expect(getSourceLabel(secretKey("k", "Secret Key 3", 0), t)).toBe(
      "accountsRecoveryScreen.secretKeyLabel:3",
    );
  });

  it("shows a label with no number as stored", () => {
    expect(getSourceLabel(phrase("p", "My phrase", 0), t)).toBe("My phrase");
  });
});

describe("groupAccountsBySource", () => {
  const sources = [
    secretKey("key-1", "Secret Key 1", 2),
    phrase("phrase-2", "Seed Phrase 2", 3),
    phrase("phrase-1", "Seed Phrase 1", 1),
  ];

  it("lists phrases before keys, each oldest first", () => {
    const groups = groupAccountsBySource({
      accounts: [
        account("a", "phrase-1"),
        account("b", "phrase-2"),
        account("c", "key-1"),
      ],
      sources,
      t,
    });

    expect(groups.map(({ key, kind }) => [key, kind])).toEqual([
      ["phrase-1", AccountGroupKind.PHRASE],
      ["phrase-2", AccountGroupKind.PHRASE],
      ["key-1", AccountGroupKind.SECRET_KEY],
    ]);
  });

  it("keeps each account under its own source, in list order", () => {
    const [first] = groupAccountsBySource({
      accounts: [
        account("a", "phrase-1"),
        account("b", "phrase-2"),
        account("c", "phrase-1"),
      ],
      sources,
      t,
    });

    expect(first.accounts.map(({ id }) => id)).toEqual(["a", "c"]);
    expect(first.sourceId).toBe("phrase-1");
  });

  it("puts accounts with no known source in a trailing group", () => {
    const groups = groupAccountsBySource({
      accounts: [
        account("a", "phrase-1"),
        account("legacy"),
        account("orphan", "removed-source"),
      ],
      sources,
      t,
    });

    const other = groups[groups.length - 1];
    expect(other.kind).toBe(AccountGroupKind.OTHER);
    expect(other.label).toBe("accountsRecoveryScreen.otherAccounts");
    expect(other.sourceId).toBeUndefined();
    expect(other.accounts.map(({ id }) => id)).toEqual(["legacy", "orphan"]);
  });

  it("leaves out sources with no accounts", () => {
    const groups = groupAccountsBySource({
      accounts: [account("c", "key-1")],
      sources,
      t,
    });

    expect(groups.map(({ key }) => key)).toEqual(["key-1"]);
  });

  it("lists every account exactly once", () => {
    const accounts = [
      account("a", "phrase-1"),
      account("b", "key-1"),
      account("c"),
      account("d", "phrase-2"),
    ];
    const ids = groupAccountsBySource({ accounts, sources, t })
      .flatMap((group) => group.accounts)
      .map(({ id }) => id)
      .sort();

    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});
