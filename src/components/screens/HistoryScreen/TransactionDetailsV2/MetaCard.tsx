import { List, ListItemProps } from "components/List";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { HistoryEntryDetails } from "helpers/history/v2/model";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

/**
 * Metadata card for the v2 transaction detail sheet: fee always, and the
 * swap rate / counterparty rows only when the entry has them — filtered out
 * rather than rendered empty, the way
 * TransactionDetailsBottomSheetCustomContent's detailItems already does.
 */
export const MetaCard: React.FC<{ details: HistoryEntryDetails }> = ({
  details,
}) => {
  const { t } = useAppTranslation();

  const items = [
    {
      key: "fee",
      title: t("history.v2.detail.fee"),
      value: formatTokenForDisplay(details.fee, NATIVE_TOKEN_CODE),
    },
    details.rate && {
      key: "rate",
      title: t("history.v2.detail.rate"),
      value: details.rate,
    },
    details.counterparty && {
      key: "counterparty",
      title: t("history.v2.detail.counterparty"),
      value: truncateAddress(details.counterparty),
    },
  ].filter(Boolean) as ListItemProps[];

  return <List items={items} variant="secondary" />;
};
