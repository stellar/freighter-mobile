import blendIcon from "assets/logos/blend-icon.png";
import { formatRate } from "components/screens/EarnScreen/helpers";
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
  /** Opens `PoolDetailsBottomSheet` -- the design's only route there now
   *  that the token picker's invented header info-button is gone. */
  onPress: () => void;
  testID?: string;
}

/**
 * Amount screen's pool-identity card, redesigned per Figma `12607:42834`
 * (nodes `12607:42851`/`42852` for the tab, `I12607:42855;4603:1211` for the
 * row): a "Current APY" tab sitting flush on top of a pool row (identity +
 * a chevron button), which is this screen's only entry into
 * `PoolDetailsBottomSheet`.
 *
 * Three things the redesign changed, all of which the previous pass had
 * inferred from an older mock and got wrong:
 *
 * - The tab is a DARK green (`Success/Background/Secondary` #0c1f17, an exact
 *   match for `green[2]`) with `green/9` text -- not the solid `green[10]`
 *   fill with `green[4]` text that `EarnTokenRow`'s pill uses. The two are
 *   deliberately different treatments now.
 * - Its shape is a top-rounded strip inset 16 on each side, not a full-width
 *   pill, and it sits FLUSH above the card rather than tucked under it by a
 *   negative margin -- the design lists them as non-overlapping siblings, and
 *   the inset alone produces the tab motif.
 * - The identity icon is the real Blend mark. It is byte-identical to the
 *   token picker's badge glyph, so it reuses that same asset rather than the
 *   lilac `InfoCircle` placeholder that stood in while no artwork existed.
 *
 * When the asset has no fresh APY (`apy === null`), the tab is omitted
 * entirely, mirroring `EarnTokenRow`'s same-shaped fallback rather than
 * inventing an unspecified "no rate" state.
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
        <View className="mx-4">
          <View
            className="items-center justify-center rounded-t-2xl px-3 py-0.5"
            style={{ backgroundColor: themeColors.green[2] }}
          >
            <Text xs medium color={themeColors.green[9]}>
              {t("earnAmount.poolCard.currentApy", { rate: formatRate(apy) })}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="flex-row items-center justify-between px-4 py-3 rounded-2xl bg-background-tertiary"
        testID={testID ? `${testID}-row` : undefined}
        accessibilityRole="button"
        accessibilityLabel={t("earnAmount.poolCard.accessibilityLabel")}
      >
        <View className="flex-row items-center flex-1 mr-4">
          <Image
            source={blendIcon}
            className="size-10 rounded"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View className="ml-4 flex-1">
            {pool.name && (
              <Text md medium primary numberOfLines={1}>
                {pool.name}
              </Text>
            )}
            <Text sm medium secondary numberOfLines={1}>
              {t("earnAmount.poolCard.byBlend")}
            </Text>
          </View>
        </View>
        {/* 34x34 (10 padding around a 14 glyph) on the page background, so it
            reads as a well punched into the card rather than a raised chip. */}
        <View
          className="size-[34px] items-center justify-center rounded-full"
          style={{ backgroundColor: themeColors.background.primary }}
        >
          <Icon.ChevronRight size={14} color={themeColors.text.primary} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default PoolCard;
