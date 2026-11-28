import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import { BlendPoolIcon } from "components/screens/EarnScreen/components/BlendPoolIcon";
import { formatRate } from "components/screens/EarnScreen/helpers";
import {
  PositionFigures,
  PositionSection,
  PositionTokenLine,
} from "components/screens/PositionsScreen/components/PositionParts";
import {
  formatPositionGain,
  formatPositionTokens,
  formatPositionUsd,
  getPositionPoolName,
} from "components/screens/PositionsScreen/helpers/positionFigures";
import {
  PositionTokenRow,
  getPositionRowName,
  getPositionRowToken,
  toPositionTokenRows,
} from "components/screens/PositionsScreen/helpers/positionRows";
import { getPoolPositionSummary } from "components/screens/PositionsScreen/helpers/positionSummaries";
import { useAccountPositions } from "components/screens/PositionsScreen/hooks/useAccountPositions";
import { useCloseWhenGone } from "components/screens/PositionsScreen/hooks/useCloseWhenGone";
import { useArePositionsAvailable } from "components/screens/PositionsScreen/hooks/useEarnAvailability";
import { usePositionsRefresh } from "components/screens/PositionsScreen/hooks/usePositionsRefresh";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, mapNetworkToNetworkDetails } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo } from "react";
import { ScrollView, View } from "react-native";
import { trackEarnPoolDetailsOpened } from "services/analytics/earn";
import { trackPositionsRowSelected } from "services/analytics/positions";

const CHIP_ICON_SIZE = 20;

type PoolPositionScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.POOL_POSITION_SCREEN
>;

/**
 * Everything the account holds in one pool: the pool's total and its gain on
 * principal, then one card per supplied token, each opening that token's
 * position. It reads the live positions, so a refresh updates it in place,
 * and it closes when a refresh drops the pool (fully withdrawn) or Positions
 * go away (the flag, or a network without Earn).
 */
export const PoolPositionScreen: React.FC<PoolPositionScreenProps> = ({
  navigation,
  route,
}) => {
  const { poolId } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const network = useAuthenticationStore((state) => state.network);
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );
  const isAvailable = useArePositionsAvailable();
  usePositionsRefresh({ publicKey: account?.publicKey, network, isAvailable });

  const { positions, hasLoaded } = useAccountPositions();
  const position = positions.find((pool) => pool.poolId === poolId) ?? null;
  const rows = useMemo(
    () => (position ? toPositionTokenRows({ position, networkDetails }) : []),
    [position, networkDetails],
  );

  // A token screen open over this one closes itself too.
  useCloseWhenGone({
    isGone: !isAvailable || (hasLoaded && !position),
    navigation,
    routeKey: route.key,
  });

  const handleTokenPress = useCallback(
    (row: PositionTokenRow) => {
      trackPositionsRowSelected({
        poolId: row.poolId,
        protocol: row.protocol,
        assetCode: row.code,
      });
      // The token's screen carries the pool's Overview, which is what the
      // extension's pool details sheet shows.
      trackEarnPoolDetailsOpened({
        poolId: row.poolId,
        source: "position_row",
      });
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.TOKEN_POSITION_SCREEN, {
        poolId: row.poolId,
        assetId: row.assetId,
        tokenCode: row.code,
      });
    },
    [navigation],
  );

  if (!position) {
    return <BaseLayout insets={{ top: false }}>{null}</BaseLayout>;
  }

  const summary = getPoolPositionSummary(position);

  return (
    <BaseLayout insets={{ top: false, left: false, right: false }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
        testID="pool-position-screen"
      >
        <View className="gap-[12px]">
          <View className="items-start gap-[8px]">
            <View
              className="flex-row items-center gap-[4px] rounded-[8px] px-[10px] py-[4px]"
              style={{ backgroundColor: themeColors.gray[3] }}
            >
              <BlendPoolIcon
                style={{
                  width: CHIP_ICON_SIZE,
                  height: CHIP_ICON_SIZE,
                  borderRadius: 4,
                }}
              />
              {/* Blend's name, not copy: the same in every language. */}
              <Text md medium primary>
                Blend
              </Text>
            </View>
            <Text md medium secondary testID="pool-position-name">
              {getPositionPoolName(position.name, t)}
            </Text>
          </View>
          <PositionFigures
            total={formatPositionUsd(summary.totalUsd)}
            gain={formatPositionGain(summary.interestUsd, summary.gainPercent)}
            gainValue={summary.interestUsd}
            testIDPrefix="pool-position"
          />
        </View>

        <View className="pt-[24px]">
          <PositionSection
            title={t("positions.poolScreen.suppliedTokens")}
            titleSize="md"
          >
            <View className="gap-[12px]">
              {rows.map((row) => (
                <PositionTokenLine
                  key={row.assetId}
                  icon={<TokenIcon token={getPositionRowToken(row)} />}
                  name={getPositionRowName(row)}
                  subtitle={t("positions.apy", { rate: formatRate(row.apy) })}
                  value={formatPositionUsd(row.suppliedUsd)}
                  amount={formatPositionTokens(row.suppliedTokens, row.code)}
                  cardRadius={12}
                  iconGap={12}
                  onPress={() => handleTokenPress(row)}
                  testID={`position-row-${row.code}`}
                />
              ))}
            </View>
          </PositionSection>
        </View>
      </ScrollView>
    </BaseLayout>
  );
};

export default PoolPositionScreen;
