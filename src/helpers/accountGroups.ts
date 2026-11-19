import { Account, SecretSource, SecretSourceType } from "config/types";
import { TFunction } from "i18next";

type Translate = TFunction<"translations">;

export enum AccountGroupKind {
  PHRASE = "phrase",
  SECRET_KEY = "secretKey",
  OTHER = "other",
}

export interface AccountGroup {
  /** Stable across renders and sheet reopenings; keys collapsed state. */
  key: string;
  kind: AccountGroupKind;
  label: string;
  /** The source that roots every account in the group; none for OTHER. */
  sourceId?: string;
  accounts: Account[];
}

/*
  Sources are numbered within their type when they are added ("Seed Phrase 2",
  "Secret Key 1") and a number is never reused. The stored label is in
  English, so the screens keep that number and translate the rest.
*/
const getLabelNumber = (label: string) => /(\d+)$/.exec(label)?.[1];

export const getSourceLabel = (source: SecretSource, t: Translate): string => {
  const number = getLabelNumber(source.label);

  if (!number) {
    return source.label;
  }

  return source.type === SecretSourceType.PHRASE
    ? t("accountsRecoveryScreen.recoveryPhraseLabel", { number })
    : t("accountsRecoveryScreen.secretKeyLabel", { number });
};

/**
 * Groups accounts under the source that roots them: phrases first, then
 * imported keys, each oldest first. Every account appears exactly once. One
 * with no known source (a pre-V2 record sign-in has not attributed yet) lands
 * in a trailing group rather than being dropped. Empty groups are left out.
 */
export const groupAccountsBySource = ({
  accounts,
  sources,
  t,
}: {
  accounts: Account[];
  sources: SecretSource[];
  t: Translate;
}): AccountGroup[] => {
  const byAge = [...sources].sort((a, b) => a.createdAt - b.createdAt);
  const ordered = [
    ...byAge.filter((s) => s.type === SecretSourceType.PHRASE),
    ...byAge.filter((s) => s.type === SecretSourceType.SECRET_KEY),
  ];
  const known = new Set(ordered.map((s) => s.id));

  const groups: AccountGroup[] = ordered.map((source) => ({
    key: source.id,
    kind:
      source.type === SecretSourceType.PHRASE
        ? AccountGroupKind.PHRASE
        : AccountGroupKind.SECRET_KEY,
    label: getSourceLabel(source, t),
    sourceId: source.id,
    accounts: accounts.filter((account) => account.sourceId === source.id),
  }));

  const unattributed = accounts.filter(
    (account) => !(account.sourceId && known.has(account.sourceId)),
  );
  if (unattributed.length) {
    groups.push({
      key: "other",
      kind: AccountGroupKind.OTHER,
      label: t("accountsRecoveryScreen.otherAccounts"),
      accounts: unattributed,
    });
  }

  return groups.filter((group) => group.accounts.length);
};
