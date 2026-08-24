import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { HeldBalanceItem } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import React, { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

export interface EarnSwapFromBottomSheetProps {
  /** Everything the account can sell into the pool asset. */
  balances: HeldBalanceItem[];
  network: NETWORKS;
  onSelect: (balance: HeldBalanceItem) => void;
  /** Returns to the swap sheet without changing the source. */
  onBack: () => void;
  /** Leaves the swap branch entirely. */
  onClose: () => void;
}

/**
 * Source picker for swap-within-Earn (design `13723:343723`, "Swap from").
 *
 * Unlike Swap's own destination picker, this lists ONLY what the account
 * already holds -- you cannot sell a token you do not have -- so it reuses
 * `SwapTokenRow`'s "held" variant and needs no search-by-address lookup. The
 * design's Paste button is therefore omitted: pasting a contract address is
 * meaningless against a list restricted to your own balances. The search
 * field is kept and filters that list by code or name.
 *
 * The header carries a back arrow as well as a close: back returns to the
 * swap sheet with the source unchanged, close leaves the branch. Both are in
 * the design, and they are not interchangeable.
 */
export const EarnSwapFromBottomSheet: React.FC<
  EarnSwapFromBottomSheetProps
> = ({ balances, network, onSelect, onBack, onClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return balances;
    }
    return balances.filter((item) => {
      const code = (item.tokenCode ?? "").toLowerCase();
      const name = (item.displayName ?? "").toLowerCase();
      return code.includes(needle) || name.includes(needle);
    });
  }, [balances, query]);

  return (
    <View className="flex-1 gap-[24px]" testID="earn-swap-from-bottom-sheet">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          testID="earn-swap-from-back"
        >
          <Icon.ArrowLeft size={24} color={themeColors.text.primary} />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text lg medium primary>
            {t("earnSwapFrom.title")}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} testID="earn-swap-from-close">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      <Input
        placeholder={t("earnSwapFrom.searchPlaceholder")}
        value={query}
        onChangeText={setQuery}
        fieldSize="lg"
        leftElement={
          <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
        }
        testID="earn-swap-from-search"
      />

      <View className="flex-1 gap-[12px]">
        <Text md medium primary>
          {t("earnSwapFrom.yourTokens")}
        </Text>

        {filtered.length === 0 ? (
          <Text sm secondary>
            {t("earnSwapFrom.noResults")}
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map((item) => (
              <SwapTokenRow
                key={item.id}
                variant="held"
                balance={item}
                network={network}
                onPress={() => onSelect(item)}
                testID={`earn-swap-from-${item.tokenCode}`}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default EarnSwapFromBottomSheet;
