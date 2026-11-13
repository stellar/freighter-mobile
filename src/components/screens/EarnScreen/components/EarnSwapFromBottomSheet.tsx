import { BottomSheetHeader } from "components/BottomSheetHeader";
import { TokenRowDivider } from "components/TokenRowStyle";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { HeldBalanceItem } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

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
 * Source picker for swap-within-Earn ("Swap from").
 *
 * Unlike Swap's own destination picker, this lists ONLY what the account
 * already holds -- you cannot sell a token you do not have -- so it reuses
 * `SwapTokenRow`'s "held" variant and needs no search-by-address lookup. The
 * search, and its Paste button, filter that list by code, name or address.
 *
 * The header carries a back arrow as well as a close: back returns to the
 * swap sheet with the source unchanged, close leaves the branch.
 */
export const EarnSwapFromBottomSheet: React.FC<
  EarnSwapFromBottomSheetProps
> = ({ balances, network, onSelect, onBack, onClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const [query, setQuery] = useState("");

  // Matches the code, the display name, or the token's identifier ("XLM",
  // "CODE:ISSUER" or a contract address), so a pasted issuer or contract
  // address finds its token.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return balances;
    }
    return balances.filter((item) => {
      const code = (item.tokenCode ?? "").toLowerCase();
      const name = (item.displayName ?? "").toLowerCase();
      const id = item.id.toLowerCase();
      return (
        code.includes(needle) || name.includes(needle) || id.includes(needle)
      );
    });
  }, [balances, query]);

  const handlePaste = () => {
    getClipboardText().then(setQuery);
  };

  return (
    <View className="flex-1 gap-[24px]" testID="earn-swap-from-bottom-sheet">
      <BottomSheetHeader
        title={t("earnSwapFrom.title")}
        layout="centered"
        onBack={onBack}
        backTestID="earn-swap-from-back"
        onClose={onClose}
        closeTestID="earn-swap-from-close"
      />

      <Input
        placeholder={t("earnSwapFrom.searchPlaceholder")}
        value={query}
        onChangeText={setQuery}
        fieldSize="lg"
        autoCapitalize="none"
        autoCorrect={false}
        leftElement={
          <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
        }
        endButton={{
          content: t("common.paste"),
          onPress: handlePaste,
        }}
        testID="earn-swap-from-search"
      />

      <View className="flex-1 gap-[24px]">
        <Text md medium secondary>
          {t("earnSwapFrom.yourTokens")}
        </Text>

        {filtered.length === 0 ? (
          <Text sm secondary>
            {t("earnSwapFrom.noResults")}
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map((item, index) => (
              <React.Fragment key={item.id}>
                <SwapTokenRow
                  variant="held"
                  rowStyle="shared"
                  balance={item}
                  network={network}
                  onPress={() => onSelect(item)}
                  testID={`earn-swap-from-${item.tokenCode}`}
                />
                {index < filtered.length - 1 ? <TokenRowDivider /> : null}
              </React.Fragment>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default EarnSwapFromBottomSheet;
