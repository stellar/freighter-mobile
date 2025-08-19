import Blockaid from "@blockaid/client";
import { AssetIcon } from "components/AssetIcon";
import { ListItemProps } from "components/List";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { AssetTypeWithCustomToken, TokenIdentifier } from "config/types";
import { usePricesStore } from "ducks/prices";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View } from "react-native";
import { getTransactionBalanceChanges } from "services/blockaid/helper";

/**
 * Adapter hook that maps Blockaid transaction simulation results
 * into `ListItemProps[]` for display.
 *
 * Scenarios handled:
 * - No result or simulation error → single row "Unable to simulate transaction"
 * - No diffs → single row "No balance changes detected"
 * - Otherwise, render one row per asset with signed amount (red for debit, green for credit)
 */
export const useTransactionBalanceListItems = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
): ListItemProps[] => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return useMemo(() => {
    const balanceUpdates = getTransactionBalanceChanges(scanResult);

    // Unable to simulate
    if (balanceUpdates === null) {
      return [
        {
          icon: <Icon.Cube01 size={14} themeColor="gray" />,
          title: t("blockaid.security.transaction.unableToSimulate"),
          titleColor: themeColors.text.secondary,
        },
      ];
    }

    // No changes
    if (balanceUpdates.length === 0) {
      return [
        {
          icon: <Icon.Cube01 size={14} themeColor="gray" />,
          title: t("blockaid.security.transaction.noBalanceChanges"),
          titleColor: themeColors.text.secondary,
        },
      ];
    }

    // Build token IDs and optionally fetch missing prices
    const tokenIds: TokenIdentifier[] = balanceUpdates.map((c) =>
      c.isNative ? "XLM" : `${c.assetCode}:${c.assetIssuer ?? ""}`,
    );

    // Fire-and-forget fetch of missing prices (non-blocking render)
    const { prices, fetchPricesForTokenIds } = usePricesStore.getState();
    const missing = tokenIds.filter((id) => !prices[id]);
    if (missing.length > 0) {
      // Fire and ignore resolution; store handles errors
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetchPricesForTokenIds({ tokens: missing });
    }

    // Render changes
    return balanceUpdates.map((change) => {
      const { assetCode, assetIssuer, isNative, amount, isCredit } = change;
      const sign = isCredit ? "+" : "-";
      const formattedAmount = `${sign}${formatAssetAmount(amount, assetCode)}`;

      const tokenId: TokenIdentifier = isNative
        ? NATIVE_TOKEN_CODE
        : `${assetCode}:${assetIssuer ?? ""}`;
      const price = usePricesStore.getState().prices[tokenId]?.currentPrice;
      const hasFiat = !!price;
      const fiatValue = hasFiat ? price.multipliedBy(amount.abs()) : null;

      const token = isNative
        ? { type: AssetTypeWithCustomToken.NATIVE, code: NATIVE_TOKEN_CODE }
        : { code: assetCode, issuer: { key: assetIssuer ?? "" } };

      return {
        key: `${assetCode}:${assetIssuer ?? "native"}`,
        icon: <AssetIcon token={token as never} size="sm" />,
        title: assetCode,
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text md primary>
              {assetCode}
            </Text>
            {hasFiat && fiatValue && (
              <Text secondary>{formatFiatAmount(fiatValue)}</Text>
            )}
          </View>
        ),
        trailingContent: (
          <Text
            md
            color={
              isCredit ? themeColors.status.success : themeColors.status.error
            }
          >
            {formattedAmount}
          </Text>
        ),
        titleColor: themeColors.text.primary,
      } as ListItemProps;
    });
  }, [
    scanResult,
    t,
    themeColors.status.error,
    themeColors.status.success,
    themeColors.text.primary,
    themeColors.text.secondary,
  ]);
};

export default useTransactionBalanceListItems;
