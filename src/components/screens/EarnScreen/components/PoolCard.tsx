import { formatRate } from "components/screens/EarnScreen/helpers";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BlendCatalogPool } from "config/blendTypes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

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
 * Amount screen's pool-identity card (Figma node `9448:29157`): a green
 * "Current APY" ribbon tucked above a pool row (identity + a chevron
 * button), which is this screen's only entry into `PoolDetailsBottomSheet`.
 *
 * The ribbon's fill/text are copied verbatim from `EarnTokenRow`'s APY pill
 * (`bg-green-10` / `themeColors.green[4]`) rather than SDS `Badge`'s
 * "success" variant, which resolves to lime, not this teal-green -- see that
 * component's own comment for the pixel-sampling that confirmed it. When the
 * asset has no fresh APY (`apy === null`), the ribbon is omitted entirely,
 * mirroring `EarnTokenRow`'s same-shaped fallback rather than inventing an
 * unspecified "no rate" ribbon state.
 *
 * No pool-artwork asset exists yet, so the identity icon reuses
 * `PoolDetailsBottomSheet`'s own placeholder treatment (lilac `InfoCircle`
 * in a themed square) for visual consistency between the two surfaces,
 * rather than introducing a second, different placeholder.
 *
 * In the mock the ribbon visually tucks behind the card below it (a "tab"
 * reading), while the raw geometry lists them as flush, non-overlapping
 * siblings. This renders that "tab" reading with a small negative margin --
 * just enough to tuck the pill's rounded bottom corners under the card's
 * rounded top ones -- rather than the literal flush layout, since the
 * visual note is explicit about the overlap and a flush stack would lose
 * the ribbon/tab motif entirely. The overlap is kept shallow (4px, well
 * under the pill's own vertical text inset) so it never crops the "Current
 * APY" text itself, unlike a literal half-height overlap would.
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
        <View className="mx-4 h-[22px] rounded-full bg-green-10 items-center justify-center -mb-[4px]">
          <Text sm medium color={themeColors.green[4]}>
            {t("earnAmount.poolCard.currentApy", { rate: formatRate(apy) })}
          </Text>
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
          <Icon.InfoCircle themeColor="lilac" withBackground square size={28} />
          <View className="ml-4 flex-1">
            {pool.name && (
              <Text md medium primary numberOfLines={1}>
                {pool.name}
              </Text>
            )}
            <Text sm regular secondary numberOfLines={1}>
              {t("earnAmount.poolCard.byBlend")}
            </Text>
          </View>
        </View>
        <View className="w-[32px] h-[32px] rounded-full items-center justify-center bg-gray-4">
          <Icon.ChevronRight size={18} color={themeColors.text.primary} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default PoolCard;
