import { InlineAddButton } from "components/InlineAddButton";
import { PoolPositionCard } from "components/screens/PositionsScreen/components/PoolPositionCard";
import { PositionsEmptyState } from "components/screens/PositionsScreen/components/PositionsEmptyState";
import { projectAnnualEarnings } from "components/screens/PositionsScreen/helpers/earnProjection";
import { useAccountPositions } from "components/screens/PositionsScreen/hooks/useAccountPositions";
import { Notification } from "components/sds/Notification";
import { BlendPoolPosition } from "config/blendTypes";
import { DEFAULT_PADDING, mapNetworkToNetworkDetails } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { usePositionsStore } from "ducks/positions";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

interface PositionsTabProps {
  /** Deposits are offered (`earn_deposit` on a supported network). */
  canDeposit: boolean;
  onPoolPress: (position: BlendPoolPosition) => void;
  /** The tab's own Deposit button, which ends the list. */
  onDepositPress: () => void;
  /** The empty card's Start Earning. */
  onStartEarningPress: () => void;
}

/**
 * Home's Positions tab: one card per pool the account supplies to, ending
 * with a Deposit button as Tokens and Collectibles end with their Add
 * buttons.
 *
 * Unlike those lists it has a real error state: a position is money, so "we
 * could not load this" must never read as "you have none". A failed refresh
 * keeps the last positions on screen (see the store), so the error shows only
 * while there is nothing to show.
 */
export const PositionsTab: React.FC<PositionsTabProps> = ({
  canDeposit,
  onPoolPress,
  onDepositPress,
  onStartEarningPress,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const network = useAuthenticationStore((state) => state.network);
  const pricedBalances = useBalancesStore((state) => state.pricedBalances);
  const earnOptions = usePositionsStore((state) => state.earnOptions);
  const earnOptionsNetwork = usePositionsStore(
    (state) => state.earnOptionsNetwork,
  );
  const { positions, hasLoaded, error } = useAccountPositions();

  const projection = useMemo(
    () =>
      projectAnnualEarnings({
        options: earnOptionsNetwork === network ? earnOptions : null,
        balances: pricedBalances,
        networkDetails: mapNetworkToNetworkDetails(network),
      }),
    [earnOptions, earnOptionsNetwork, network, pricedBalances],
  );

  const sidePadding = { paddingHorizontal: pxValue(DEFAULT_PADDING) };

  if (error) {
    return (
      <View className="pt-[8px]" style={sidePadding}>
        <Notification
          variant="error"
          title={t("positions.error.title")}
          message={t("positions.error.description")}
        />
      </View>
    );
  }

  if (!hasLoaded) {
    return (
      <View
        className="flex-1 items-center justify-center py-[24px]"
        testID="positions-tab-spinner"
      >
        <ActivityIndicator
          size="large"
          color={themeColors.foreground.primary}
        />
      </View>
    );
  }

  if (!positions.length) {
    return (
      <View className="pt-[8px]" style={sidePadding}>
        <PositionsEmptyState
          projectedUsd={projection.usd}
          bestApy={projection.bestApy}
          canDeposit={canDeposit}
          onStartEarningPress={onStartEarningPress}
        />
      </View>
    );
  }

  return (
    <View className="gap-[12px] pt-[8px]" style={sidePadding}>
      <View className="gap-[8px]" testID="positions-list">
        {positions.map((position) => (
          <PoolPositionCard
            key={position.poolId}
            position={position}
            onPress={onPoolPress}
          />
        ))}
      </View>
      {canDeposit ? (
        <InlineAddButton
          label={t("positions.deposit")}
          onPress={onDepositPress}
          testID="positions-deposit-button"
        />
      ) : null}
    </View>
  );
};
