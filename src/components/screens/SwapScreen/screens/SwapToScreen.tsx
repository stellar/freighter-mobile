/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { FormattedSearchTokenRecord, PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo } from "react";
import { SectionList, View } from "react-native";

type SwapToScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

export const SwapToScreen: React.FC<SwapToScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { selectionType } = route.params;
  const { setSourceToken, setDestinationToken } = useSwapStore();
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const {
    yourTokens,
    popularTokens,
    searchResults,
    hadSorobanMatches,
    stellarExpertDown,
    searchTerm,
    handleSearch,
  } = useSwapTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
  });

  // Section data: idle = "Your tokens" + "Popular tokens"; active = "Results"
  const sections = useMemo(() => {
    if (searchTerm) {
      return [
        {
          title: t("swapScreen.resultsSection"),
          data: searchResults as Array<
            (PricedBalance & { id: string }) | FormattedSearchTokenRecord
          >,
        },
      ];
    }

    const out: Array<{
      title: string;
      data: Array<
        (PricedBalance & { id: string }) | FormattedSearchTokenRecord
      >;
    }> = [];

    if (yourTokens.length > 0) {
      out.push({
        title: t("swapScreen.yourTokensSection"),
        data: yourTokens,
      });
    }

    if (popularTokens.length > 0) {
      out.push({
        title: t("swapScreen.popularTokensSection"),
        data: popularTokens,
      });
    }

    return out;
  }, [searchTerm, searchResults, yourTokens, popularTokens, t]);

  // Soroban empty-state: search has term, no results, and either there were
  // Soroban matches filtered out OR the term itself looks like a contract ID.
  const showSorobanEmpty =
    searchTerm.length > 0 &&
    searchResults.length === 0 &&
    (hadSorobanMatches || isContractId(searchTerm));

  const handleHeldPress = (balance: PricedBalance & { id: string }) => {
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      setSourceToken(balance.id, balance.tokenCode ?? "");
    } else {
      setDestinationToken(descriptorFromBalance(balance));
    }
    navigation.goBack();
  };

  // Non-held tokens only appear in destination mode (popularTokens / non-held
  // search results). The source picker lists held tokens only, so this handler
  // is always destination-mode.
  const handleRecordPress = (record: FormattedSearchTokenRecord) => {
    setDestinationToken(descriptorFromSearchRecord(record));
    navigation.goBack();
  };

  const isHeldToken = (
    item: (PricedBalance & { id: string }) | FormattedSearchTokenRecord,
  ): item is PricedBalance & { id: string } => "id" in item;

  const getItemKey = (
    item: (PricedBalance & { id: string }) | FormattedSearchTokenRecord,
  ): string => {
    if (isHeldToken(item)) {
      return item.id;
    }
    return `${item.tokenCode}:${item.issuer ?? ""}`;
  };

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <View className="px-4 pt-4 pb-2">
        <Input
          placeholder={t("swapScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={handleSearch}
        />
      </View>

      {stellarExpertDown && (
        <View className="px-4 py-2">
          <Text sm secondary>
            {t("swapScreen.stellarExpertDown")}
          </Text>
        </View>
      )}

      {showSorobanEmpty ? (
        <View className="px-4 py-8">
          <Text sm secondary>
            {t("swapScreen.sorobanEmptyState")}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={getItemKey}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
          renderSectionHeader={({ section }) => (
            <View className="py-3">
              <Text md medium primary>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            // "Your tokens" section always uses the held variant
            if (
              section.title === t("swapScreen.yourTokensSection") &&
              isHeldToken(item)
            ) {
              return (
                <SwapTokenRow
                  variant="held"
                  balance={item}
                  network={network}
                  onPress={() => handleHeldPress(item)}
                />
              );
            }

            // For Results section: check if the record matches a held balance
            if (!isHeldToken(item)) {
              const record = item;
              const heldMatch = balanceItems.find(
                (b) =>
                  b.id === `${record.tokenCode}:${record.issuer}` ||
                  (record.isNative && b.id === "native"),
              );

              if (heldMatch) {
                return (
                  <SwapTokenRow
                    variant="held"
                    balance={heldMatch}
                    network={network}
                    onPress={() => handleHeldPress(heldMatch)}
                  />
                );
              }

              // Source mode never shows non-held tokens
              if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
                return null;
              }

              return (
                <SwapTokenRow
                  variant="non-held"
                  record={record}
                  network={network}
                  onPress={() => handleRecordPress(record)}
                />
              );
            }

            // Fallback for held items that end up in non-yourTokens sections
            if (isHeldToken(item)) {
              return (
                <SwapTokenRow
                  variant="held"
                  balance={item}
                  network={network}
                  onPress={() => handleHeldPress(item)}
                />
              );
            }

            return null;
          }}
        />
      )}
    </BaseLayout>
  );
};

export default SwapToScreen;
