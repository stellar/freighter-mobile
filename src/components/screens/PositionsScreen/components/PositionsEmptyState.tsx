import { EmptyState } from "components/EmptyState";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { fsValue, pxValue } from "helpers/dimensions";
import { formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/** Figma's Text/SM is 14/20; `TEXT_SIZES.sm` stays 14/22 for the rest. */
const SM_LINE_HEIGHT = 20;

interface PositionsEmptyStateProps {
  /** A year's earnings on the wallet's tokens, in USD; null if unknown. */
  projectedUsd: string | null;
  /** The best rate on offer, the fallback figure; null if unknown too. */
  bestApy: number | null;
  /** Start Earning is offered only where deposits are (`earn_deposit`). */
  canDeposit: boolean;
  onStartEarningPress: () => void;
}

/**
 * The Positions tab with nothing supplied: Home's empty card, as Tokens and
 * Collectibles show theirs, with an "Earn up to" row.
 *
 * "Earn up to" is what the wallet's own tokens would earn in a year at each
 * token's best rate. With none of them held it falls back to the best rate on
 * offer, and with neither figure known the row is left out. With deposits off
 * the card stays, without its button: it informs, it doesn't offer.
 */
export const PositionsEmptyState: React.FC<PositionsEmptyStateProps> = ({
  projectedUsd,
  bestApy,
  canDeposit,
  onStartEarningPress,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const hasProjection = projectedUsd !== null || bestApy !== null;

  const projection = hasProjection ? (
    <View
      className="items-center gap-[4px] px-[16px] py-[8px]"
      style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: themeColors.border.primary,
      }}
      testID="positions-empty-projection"
    >
      <Text
        sm
        medium
        secondary
        textAlign="center"
        style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
      >
        {t("positions.empty.earnUpTo")}
      </Text>
      <View className="flex-row flex-wrap items-center justify-center">
        <Text
          md
          semiBold
          color={themeColors.green[11]}
          testID="positions-empty-projection-figure"
        >
          {`${
            projectedUsd !== null
              ? formatFiatAmount(projectedUsd)
              : formatRate(bestApy)
          } /`}
        </Text>
        <Text
          sm
          medium
          secondary
          style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
        >
          {t("positions.empty.perYear")}
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <EmptyState
      title={t("positions.empty.title")}
      description={t("positions.empty.description")}
      details={projection}
      contentPaddingHorizontal={32}
      // Figma has the card 16pt from the screen's edges and 8pt under the
      // tab row, as the collectibles card. The tab's contents start 8pt under
      // the row and pad 24pt at the sides, so the card reaches 8pt past them.
      style={{ marginHorizontal: -pxValue(8) }}
      testID="positions-empty-state"
    >
      {canDeposit ? (
        <Button
          secondary
          lg
          onPress={onStartEarningPress}
          testID="positions-start-earning-button"
        >
          {t("positions.empty.startEarning")}
        </Button>
      ) : null}
    </EmptyState>
  );
};
