import blendIcon from "assets/logos/blend-icon.png";
import { formatRate } from "components/screens/EarnScreen/helpers";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BlendCatalogPool } from "config/blendTypes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";

export interface PoolCardProps {
  pool: BlendCatalogPool | null;
  /** Selected asset's headline APY, as read off the earn duck. */
  apy: number | null;
  /** Opens `PoolDetailsBottomSheet`. */
  onPress: () => void;
  testID?: string;
}

/**
 * The amount screen's pool card: a "Deposit APY" ribbon sitting flush on top
 * of the pool row (Blend mark, pool name, "by Blend" and a chevron button).
 * The whole row opens the pool details sheet.
 *
 * The ribbon is a top-rounded strip inset 16 on each side, in success green on
 * a pale green fill, like the picker's APY pills. When the asset has no fresh
 * APY (`apy === null`) the ribbon is omitted rather than showing a rate that
 * isn't known.
 */
export const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  apy,
  onPress,
  testID,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  if (!pool) {
    return null;
  }

  return (
    <View testID={testID}>
      {apy !== null && (
        <View className="px-[16px]">
          <View
            className="items-center justify-center rounded-t-[16px] px-[12px] py-[4px]"
            style={{ backgroundColor: themeColors.green[4] }}
          >
            <Text xs medium color={themeColors.green[11]}>
              {t("earnAmount.poolCard.depositApy", { rate: formatRate(apy) })}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row items-center gap-[16px] rounded-[16px] bg-background-secondary px-[16px] py-[12px]"
        testID={testID ? `${testID}-row` : undefined}
        accessibilityRole="button"
        accessibilityLabel={t("earnAmount.poolCard.accessibilityLabel")}
      >
        <View className="flex-1 flex-row items-center gap-[16px]">
          <Image
            source={blendIcon}
            className="size-[40px] rounded-full"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View className="flex-1">
            {pool.name && (
              <Text md medium primary numberOfLines={1}>
                {getPoolDisplayName(pool.name, t)}
              </Text>
            )}
            <Text sm medium secondary numberOfLines={1}>
              {t("earnAmount.poolCard.byBlend")}
            </Text>
          </View>
        </View>
        <View className="h-[34px] items-center justify-center rounded-full bg-base-0 px-[10px] py-[6px]">
          <Icon.ChevronRight size={14} color={themeColors.foreground.primary} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default PoolCard;
