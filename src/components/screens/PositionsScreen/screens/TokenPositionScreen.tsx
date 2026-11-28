import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TokenIcon } from "components/TokenIcon";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  formatProjection,
  formatRate,
} from "components/screens/EarnScreen/helpers";
import { PositionActivityList } from "components/screens/PositionsScreen/components/PositionActivityList";
import { PositionOverview } from "components/screens/PositionsScreen/components/PositionOverview";
import {
  PositionFigures,
  PositionSection,
  PositionTokenLine,
  useGainColor,
} from "components/screens/PositionsScreen/components/PositionParts";
import {
  formatPositionGain,
  formatPositionTokens,
  formatPositionUsd,
  getGainTone,
  getPositionPoolName,
} from "components/screens/PositionsScreen/helpers/positionFigures";
import {
  getPositionRowName,
  getPositionRowToken,
  toPositionTokenRows,
} from "components/screens/PositionsScreen/helpers/positionRows";
import {
  getGainPercent,
  getPositionSummary,
} from "components/screens/PositionsScreen/helpers/positionSummaries";
import { useAccountPositions } from "components/screens/PositionsScreen/hooks/useAccountPositions";
import {
  useArePositionsAvailable,
  useIsEarnDepositAvailable,
} from "components/screens/PositionsScreen/hooks/useEarnAvailability";
import {
  hasSpendableBalance,
  useEarnEntry,
} from "components/screens/PositionsScreen/hooks/useEarnEntry";
import { usePositionsRefresh } from "components/screens/PositionsScreen/hooks/usePositionsRefresh";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import Tabs from "components/sds/Tabs";
import { Text } from "components/sds/Typography";
import { getBlendPoolId } from "config/blend";
import { DEFAULT_PADDING, mapNetworkToNetworkDetails } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { usePositionsStore } from "ducks/positions";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { pxValue } from "helpers/dimensions";
import { NO_FIAT_VALUE } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { LayoutChangeEvent, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { trackEarnPoolDetailsTabSelected } from "services/analytics/positions";

type PositionTab = "your_position" | "overview";

const TOKEN_ICON_SIZE = 40;
const EARN_BADGE_SIZE = 20;
const EARN_BADGE_ICON_SIZE = 12;

type TokenPositionScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.TOKEN_POSITION_SCREEN
>;

/**
 * The CTA's backdrop: the page color, fading out over the top 30% so the
 * content scrolling under it dissolves, as Figma draws it.
 */
const CtaFade: React.FC<{ color: string }> = ({ color }) => {
  const gradientId = `position-cta-fade-${useId().replace(/:/g, "")}`;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.3" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
};

/**
 * One supplied token's position: what it's worth and has earned, then a
 * "Your position" tab with its deposits, earnings and activity, and an
 * "Overview" tab about the pool. Deposits are principal and earnings are
 * interest, so the two add up to the balance at the top. Withdraw is not
 * offered yet, so Deposit takes the whole width.
 *
 * Deposit is offered for the pool Earn offers alone, with its catalog entry
 * listing the token, and the `earn_deposit` flag on: this entry skips the
 * token picker, so it must not open deposits the flow hasn't vetted.
 */
export const TokenPositionScreen: React.FC<TokenPositionScreenProps> = ({
  navigation,
  route,
}) => {
  const { poolId, assetId } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const gainColor = useGainColor();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { account } = useGetActiveAccount();
  const network = useAuthenticationStore((state) => state.network);
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );
  const isAvailable = useArePositionsAvailable();
  const isEarnDepositAvailable = useIsEarnDepositAvailable();
  usePositionsRefresh({ publicKey: account?.publicKey, network, isAvailable });

  const { positions, hasLoaded } = useAccountPositions();
  const position = positions.find((pool) => pool.poolId === poolId) ?? null;
  const row = useMemo(
    () =>
      position
        ? (toPositionTokenRows({ position, networkDetails }).find(
            (candidate) => candidate.assetId === assetId,
          ) ?? null)
        : null,
    [position, networkDetails, assetId],
  );

  // A drained token closes this screen. A pool that's gone, or Positions
  // going away, close the pool screen under it, which closes this one too.
  const isRowGone = isAvailable && hasLoaded && !!position && !row;
  useEffect(() => {
    if (isRowGone) {
      navigation.goBack();
    }
  }, [isRowGone, navigation]);

  const [tab, setTab] = useState<PositionTab>("your_position");
  const handleTabChange = useCallback(
    (value: string | number) => {
      const next = value as PositionTab;
      // A tap on the tab already open is not a change.
      if (next === tab) {
        return;
      }
      setTab(next);
      trackEarnPoolDetailsTabSelected({ poolId, tab: next });
    },
    [tab, poolId],
  );

  const pools = usePositionsStore((state) => state.pools);
  const poolsNetwork = usePositionsStore((state) => state.poolsNetwork);
  const catalogPool =
    poolsNetwork === network
      ? (pools?.find((pool) => pool.id === poolId) ?? null)
      : null;
  const reserve = catalogPool?.reserves.find(
    (candidate) => candidate.assetId === assetId,
  );
  const canDeposit =
    isEarnDepositAvailable &&
    !!catalogPool &&
    poolId === getBlendPoolId(networkDetails) &&
    !!reserve?.enabled;

  const pricedBalances = useBalancesStore((state) => state.pricedBalances);
  const transactionFee = useTransactionSettingsStore(
    (state) => state.transactionFee,
  );
  const { depositFromPosition } = useEarnEntry(navigation);
  const handleDepositPress = useCallback(() => {
    if (!row || !catalogPool) {
      return;
    }
    depositFromPosition({
      row,
      pool: catalogPool,
      canPrefill: hasSpendableBalance({
        assetId: row.assetId,
        pricedBalances,
        network,
        subentryCount: account?.subentryCount ?? 0,
        transactionFee,
      }),
    });
  }, [
    row,
    catalogPool,
    depositFromPosition,
    pricedBalances,
    network,
    account?.subentryCount,
    transactionFee,
  ]);

  const [ctaHeight, setCtaHeight] = useState(0);
  const handleCtaLayout = useCallback((event: LayoutChangeEvent) => {
    setCtaHeight(event.nativeEvent.layout.height);
  }, []);

  if (!position || !row) {
    return <BaseLayout insets={{ top: false }}>{null}</BaseLayout>;
  }

  const summary = getPositionSummary({
    position,
    focusedAssetId: assetId,
    networkDetails,
  });
  const interestUsd = summary.earnings?.usd ?? null;
  const token = getPositionRowToken(row);
  const tokenName = getPositionRowName(row);
  const sidePadding = pxValue(DEFAULT_PADDING);

  return (
    <BaseLayout
      insets={{ top: false, bottom: false, left: false, right: false }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: canDeposit ? ctaHeight : bottomInset + sidePadding,
        }}
        testID="token-position-screen"
      >
        <View style={{ paddingHorizontal: sidePadding }}>
          <PositionFigures
            mark={<TokenIcon token={token} />}
            total={formatPositionUsd(summary.currentBalanceUsd)}
            gain={formatPositionGain(
              interestUsd,
              getGainPercent(summary.currentBalanceUsd, interestUsd),
            )}
            gainValue={interestUsd}
            testIDPrefix="token-position"
          />
        </View>

        <View
          className="gap-[24px] pt-[24px]"
          style={{ paddingHorizontal: sidePadding }}
        >
          <Tabs
            size="sm"
            sizing="fill"
            options={[
              {
                label: t("positions.tokenScreen.yourPosition"),
                value: "your_position",
              },
              { label: t("positions.tokenScreen.overview"), value: "overview" },
            ]}
            selectedValue={tab}
            onValueChange={handleTabChange}
            testID="position-tabs"
          />

          {tab === "your_position" ? (
            <>
              <PositionSection title={t("positions.tokenScreen.yourDeposits")}>
                <PositionTokenLine
                  icon={<TokenIcon token={token} />}
                  name={tokenName}
                  value={formatPositionUsd(summary.deposits?.usd ?? null)}
                  amount={formatPositionTokens(
                    summary.deposits ? summary.deposits.tokens : "0",
                    row.code,
                  )}
                  testID="token-position-deposits"
                />
              </PositionSection>

              <PositionSection title={t("positions.tokenScreen.yourEarnings")}>
                <View
                  className="gap-[12px] rounded-[16px] px-[16px] py-[12px]"
                  style={{
                    backgroundColor: themeColors.background.tertiary,
                  }}
                  testID="token-position-earnings"
                >
                  <PositionTokenLine
                    isCard={false}
                    icon={
                      <View
                        style={{
                          width: TOKEN_ICON_SIZE,
                          height: TOKEN_ICON_SIZE,
                        }}
                      >
                        <TokenIcon token={token} />
                        <View
                          className="absolute items-center justify-center rounded-full"
                          style={{
                            left: 26,
                            top: 24,
                            width: EARN_BADGE_SIZE,
                            height: EARN_BADGE_SIZE,
                            backgroundColor: themeColors.lilac[3],
                          }}
                        >
                          <Icon.Earn
                            size={EARN_BADGE_ICON_SIZE}
                            color={themeColors.lilac[9]}
                          />
                        </View>
                      </View>
                    }
                    name={tokenName}
                    subtitle={t("positions.tokenScreen.depositApy", {
                      rate: formatRate(summary.apy),
                    })}
                    value={
                      formatPositionGain(interestUsd, null) ?? NO_FIAT_VALUE
                    }
                    valueColor={gainColor(getGainTone(interestUsd))}
                    isValueEmphasized
                    amount={formatPositionTokens(
                      summary.earnings ? summary.earnings.tokens : "0",
                      row.code,
                    )}
                    testID="token-position-earnings-line"
                  />
                  {[
                    {
                      key: "monthly",
                      label: t("positions.tokenScreen.estMonthlyEarnings"),
                      value: formatProjection(summary.estMonthlyUsd),
                    },
                    {
                      key: "yearly",
                      label: t("positions.tokenScreen.estYearlyEarnings"),
                      value: formatProjection(summary.estYearlyUsd),
                    },
                  ].map((estimate) => (
                    <React.Fragment key={estimate.key}>
                      <View
                        className="h-px w-full"
                        style={{ backgroundColor: themeColors.border.primary }}
                      />
                      <View className="flex-row items-center justify-between gap-[12px]">
                        <Text md medium secondary>
                          {estimate.label}
                        </Text>
                        <Text
                          md
                          medium
                          primary
                          testID={`token-position-est-${estimate.key}`}
                        >
                          {estimate.value}
                        </Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </PositionSection>

              {account?.publicKey ? (
                <PositionActivityList
                  row={row}
                  publicKey={account.publicKey}
                  networkDetails={networkDetails}
                />
              ) : null}
            </>
          ) : (
            <PositionOverview
              poolId={poolId}
              poolName={getPositionPoolName(position.name, t)}
            />
          )}
        </View>
      </ScrollView>

      {canDeposit ? (
        <View
          className="absolute bottom-0 left-0 right-0"
          style={{
            paddingHorizontal: sidePadding,
            paddingTop: sidePadding,
            paddingBottom: bottomInset + sidePadding,
          }}
          onLayout={handleCtaLayout}
        >
          <CtaFade color={themeColors.base[0]} />
          <Button
            secondary
            xl
            isFullWidth
            onPress={handleDepositPress}
            testID="token-position-deposit"
          >
            {t("positions.deposit")}
          </Button>
        </View>
      ) : null}
    </BaseLayout>
  );
};

export default TokenPositionScreen;
