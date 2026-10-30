import { Notification } from "components/sds/Notification";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

/**
 * Warns that a transaction could not be decoded, so there are no details to
 * show for it. It only states the problem: the screen that renders it decides
 * what the user can still do.
 */
export const UnreadableTransactionNotice: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View testID="unreadable-transaction-notice">
      <Notification
        variant="warning"
        title={t("signTransactionDetails.unreadable.title")}
        message={t("signTransactionDetails.unreadable.description")}
      />
    </View>
  );
};
