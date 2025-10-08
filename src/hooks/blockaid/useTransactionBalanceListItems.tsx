import Blockaid from "@blockaid/client";
import { ListItemProps } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  TokenTypeWithCustomToken,
  TokenIdentifier,
  NonNativeToken,
} from "config/types";
import { usePricesStore } from "ducks/prices";
import { formatTokenForDisplay, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View } from "react-native";
import { getTransactionBalanceChanges } from "services/blockaid/helper";

/**
 * Adapter hook that maps Blockaid transaction simulation results and change trust operations
 * into `ListItemProps[]` for display.
 *
 * Scenarios handled:
 * - No scan result → single row "Unable to simulate transaction"
 * - No balance changes AND no change trust → single row "No balance changes detected"
 * - Change trust operations → show token being added
 * - Balance changes → show token balance modifications
 * - Both change trust AND balance changes → show both (when available)
 */
export const useTransactionBalanceListItems = (
  scanResult?: Blockaid.StellarTransactionScanResponse,
  signTransactionDetails?: SignTransactionDetailsInterface | null,
): ListItemProps[] => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return useMemo(() => {
    const items: ListItemProps[] = [];

    // Handle change trust operations
    if (
      signTransactionDetails?.hasTrustlineChanges &&
      signTransactionDetails?.operations
    ) {
      const changeTrustOp = signTransactionDetails.operations.find(
        (op) => op.type === "changeTrust",
      ) as
        | { type: "changeTrust"; line?: { code?: string; issuer?: string } }
        | undefined;

      if (changeTrustOp?.line?.code && changeTrustOp?.line?.issuer) {
        const { code: assetCode, issuer: issuerKey } = changeTrustOp.line;
        const token: NonNativeToken = {
          code: assetCode,
          issuer: { key: issuerKey },
        };

        items.push({
          key: `changeTrust:${assetCode}:${issuerKey}`,
          icon: <TokenIcon token={token} size="sm" />,
          title: assetCode,
          trailingContent: (
            <View className="flex-row items-center gap-2">
              <Icon.PlusCircle size={14} themeColor="gray" />
              <Text>{t("addTokenScreen.addToken")}</Text>
            </View>
          ),
        });
      }
    }

    // Handle balance changes from Blockaid scan
    if (!scanResult) {
      // no scan but still have change trust operations
      if (items.length > 0) {
        return items;
      }

      return [
        {
          icon: <Icon.Cube01 size={14} themeColor="gray" />,
          title: t("blockaid.security.transaction.unableToSimulate"),
          titleColor: themeColors.text.secondary,
        },
      ];
    }

    const balanceUpdates = getTransactionBalanceChanges(scanResult);

    // Unable to simulate
    if (balanceUpdates === null) {
      // If we have change trust operations, show them along with the error
      if (items.length > 0) {
        items.push({
          icon: <Icon.Cube01 size={14} themeColor="gray" />,
          title: t("blockaid.security.transaction.unableToSimulate"),
          titleColor: themeColors.text.secondary,
        });

        return items;
      }

      return [
        {
          icon: <Icon.Cube01 size={14} themeColor="gray" />,
          title: t("blockaid.security.transaction.unableToSimulate"),
          titleColor: themeColors.text.secondary,
        },
      ];
    }

    // No balance changes
    if (balanceUpdates.length === 0) {
      // If we have change trust operations, show them
      if (items.length > 0) {
        return items;
      }

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
      c.isNative ? NATIVE_TOKEN_CODE : `${c.assetCode}:${c.assetIssuer ?? ""}`,
    );

    // Fire-and-forget fetch of missing prices (non-blocking render)
    const { prices, fetchPricesForTokenIds } = usePricesStore.getState();
    const missing = tokenIds.filter((id) => !prices[id]);
    if (missing.length > 0) {
      // Fire and ignore resolution; store handles errors
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetchPricesForTokenIds({ tokens: missing });
    }

    // Add balance changes to the list
    balanceUpdates.forEach((change) => {
      const {
        assetCode: tokenCode,
        assetIssuer: tokenIssuer,
        isNative,
        amount,
        isCredit,
      } = change;
      const sign = isCredit ? "+" : "-";
      const formattedAmount = `${sign}${formatTokenForDisplay(amount, tokenCode)}`;

      const tokenId: TokenIdentifier = isNative
        ? NATIVE_TOKEN_CODE
        : `${tokenCode}:${tokenIssuer ?? ""}`;
      const price = usePricesStore.getState().prices[tokenId]?.currentPrice;
      const hasFiat = !!price;
      const fiatValue = hasFiat ? price.multipliedBy(amount.abs()) : null;

      const token = isNative
        ? { type: TokenTypeWithCustomToken.NATIVE, code: NATIVE_TOKEN_CODE }
        : { code: tokenCode, issuer: { key: tokenIssuer ?? "" } };

      items.push({
        key: `balance:${tokenCode}:${tokenIssuer ?? "native"}`,
        icon: <TokenIcon token={token as never} size="sm" />,
        title: tokenCode,
        titleComponent: (
          <View className="flex-row items-center gap-[8px]">
            <Text md primary>
              {tokenCode}
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
      });
    });

    return items;
  }, [
    scanResult,
    signTransactionDetails?.hasTrustlineChanges,
    signTransactionDetails?.operations,
    t,
    themeColors.status.error,
    themeColors.status.success,
    themeColors.text.primary,
    themeColors.text.secondary,
  ]);
};

export default useTransactionBalanceListItems;
