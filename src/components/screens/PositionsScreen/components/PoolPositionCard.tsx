import { BlendPoolIcon } from "components/screens/EarnScreen/components/BlendPoolIcon";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { useGainColor } from "components/screens/PositionsScreen/components/PositionParts";
import {
  formatGainBadge,
  formatPositionUsd,
  getGainTone,
  getPositionPoolName,
} from "components/screens/PositionsScreen/helpers/positionFigures";
import { getPoolPositionSummary } from "components/screens/PositionsScreen/helpers/positionSummaries";
import { Text } from "components/sds/Typography";
import { BlendPoolPosition } from "config/blendTypes";
import { fsValue } from "helpers/dimensions";
import { NO_FIAT_VALUE } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/** Figma's Text/SM is 14/20 and Text/XS 12/18; the app's sizes run 2 taller. */
const SM_LINE_HEIGHT = 20;
const XS_LINE_HEIGHT = 18;
const ICON_SIZE = 40;
/** Blend's app icon rounds at 19% of its size. */
const ICON_RADIUS = 7.6;
const ACCENT_WIDTH = 3;

interface PoolPositionCardProps {
  position: BlendPoolPosition;
  onPress: (position: BlendPoolPosition) => void;
}

/**
 * One pool the account supplies to, on Home's Positions tab: the pool and its
 * provider, what the account holds there, its gain on principal, and the
 * pool's net APY, on a card with a blue edge. Unknown figures read "--",
 * never zero or a missing badge.
 */
export const PoolPositionCard: React.FC<PoolPositionCardProps> = ({
  position,
  onPress,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const gainColor = useGainColor();
  const summary = getPoolPositionSummary(position);
  const gainBadge = formatGainBadge(summary.gainPercent);

  return (
    <TouchableOpacity
      onPress={() => onPress(position)}
      activeOpacity={0.7}
      accessibilityRole="button"
      className="flex-row items-center overflow-hidden px-[16px] py-[12px]"
      style={{
        backgroundColor: themeColors.background.secondary,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
      }}
      testID={`pool-card-${position.poolId}`}
    >
      <View
        className="absolute bottom-0 left-0 top-0"
        style={{ width: ACCENT_WIDTH, backgroundColor: themeColors.lilac[9] }}
      />
      <View className="flex-1 flex-row items-center gap-[12px]">
        <BlendPoolIcon
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: ICON_RADIUS,
          }}
        />
        <View className="flex-1">
          <Text
            sm
            regular
            primary
            numberOfLines={1}
            style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
          >
            {getPositionPoolName(position.name, t)}
            {/* Blend's name, not copy: the same in every language. */}
            <Text sm regular secondary>
              {" · Blend"}
            </Text>
          </Text>
          <View className="flex-row items-end">
            <Text
              md
              medium
              primary
              testID={`pool-card-value-${position.poolId}`}
            >
              {formatPositionUsd(summary.totalUsd)}
            </Text>
            <View className="px-[4px] py-[2px]">
              <Text
                xs
                semiBold
                color={gainColor(getGainTone(summary.gainPercent))}
                style={{ lineHeight: fsValue(XS_LINE_HEIGHT) }}
                testID={`pool-card-gain-${position.poolId}`}
              >
                {gainBadge ?? NO_FIAT_VALUE}
              </Text>
            </View>
          </View>
          <Text
            xs
            medium
            secondary
            style={{ lineHeight: fsValue(XS_LINE_HEIGHT) }}
            testID={`pool-card-apy-${position.poolId}`}
          >
            {/* Unknown reads "-- Net APY", as the token rows read "-- APY". */}
            {t("positions.netApy", { rate: formatRate(summary.apy) })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
