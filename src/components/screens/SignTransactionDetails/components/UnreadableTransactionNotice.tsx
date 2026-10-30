import { Notification } from "components/sds/Notification";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

/** What could not be decoded, which picks the notice's wording. */
export enum UnreadableTransactionNoticeVariant {
  /**
   * A transaction: a dApp transaction request, or the send and swap
   * Transaction details.
   */
  Transaction = "transaction",
  /**
   * The authorization entry of a dApp auth-entry request
   * (`stellar_signAuthEntry`), on its request sheet and in its Authorization
   * Entry Details.
   */
  AuthEntry = "authEntry",
}

interface UnreadableTransactionNoticeProps {
  /**
   * What could not be decoded, which picks the wording. Defaults to
   * `Transaction`.
   */
  variant?: UnreadableTransactionNoticeVariant;
}

/**
 * Warns that a transaction, or an auth entry, could not be decoded, so there
 * are no details to show for it. It only states the problem: the screen that
 * renders it decides what the user can still do.
 *
 * `variant` picks the wording: the transaction one unless an auth-entry
 * request asks for its own. Both wordings render under the same `testID`.
 */
export const UnreadableTransactionNotice: React.FC<
  UnreadableTransactionNoticeProps
> = ({ variant = UnreadableTransactionNoticeVariant.Transaction }) => {
  const { t } = useAppTranslation();

  const copy: Record<
    UnreadableTransactionNoticeVariant,
    { title: string; message: string }
  > = {
    [UnreadableTransactionNoticeVariant.Transaction]: {
      title: t("signTransactionDetails.unreadable.title"),
      message: t("signTransactionDetails.unreadable.description"),
    },
    [UnreadableTransactionNoticeVariant.AuthEntry]: {
      title: t("signTransactionDetails.unreadableAuthEntry.title"),
      message: t("signTransactionDetails.unreadableAuthEntry.description"),
    },
  };
  const { title, message } = copy[variant];

  return (
    <View testID="unreadable-transaction-notice">
      <Notification variant="warning" title={title} message={message} />
    </View>
  );
};
