/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
  recordTokenId,
} from "components/screens/SwapScreen/helpers";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import {
  FormattedSearchTokenRecord,
  HookStatus,
  PricedBalance,
} from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo } from "react";
import { SectionList, View } from "react-native";
import { analytics } from "services/analytics";

type SwapToScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

export const SwapToScreen: React.FC<SwapToScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { selectionType } = route.params;
  const {
    setSourceToken,
    setDestinationToken,
    sourceTokenId,
    destinationToken,
  } = useSwapStore();
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
    status,
    searchTerm,
    handleSearch,
  } = useSwapTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
  });

  // Section data: idle = "Your tokens" + "Popular tokens"; active = "Results".
  // The opposite-side token is NOT excluded here — picking it triggers the
  // selection-swap rule (spec §12.4): the opposite side clears so the user
  // can pick a different token there.
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

    if (
      popularTokens.length > 0 &&
      selectionType === SWAP_SELECTION_TYPES.DESTINATION
    ) {
      out.push({
        title: t("swapScreen.popularTokensSection"),
        data: popularTokens,
      });
    }

    return out;
  }, [searchTerm, searchResults, yourTokens, popularTokens, selectionType, t]);

  // True while the user's debounced search is fetching (takes precedence over
  // empty-state branches so the user doesn't see "no results" mid-fetch).
  const isSearching =
    searchTerm.length > 0 &&
    status === HookStatus.LOADING &&
    searchResults.length === 0;

  // Soroban empty-state: search has term, no results, and either there were
  // Soroban matches filtered out OR the term itself looks like a contract ID.
  // Only shown when we are NOT actively fetching.
  const showSorobanEmpty =
    !isSearching &&
    searchTerm.length > 0 &&
    searchResults.length === 0 &&
    (hadSorobanMatches || isContractId(searchTerm));

  // No-results empty-state: search has term, no results, and NOT a Soroban
  // case (which has its own dedicated message). Only shown when not fetching.
  const showNoResults =
    !isSearching &&
    searchTerm.length > 0 &&
    searchResults.length === 0 &&
    !showSorobanEmpty;

  const handleHeldPress = (
    balance: PricedBalance & { id: string },
    source: "balances" | "popular" | "search",
  ) => {
    const descriptor = descriptorFromBalance(balance);
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      // Selection-swap rule (spec §12.4): if the new source equals the
      // current destination, clear destination so the user can pick a
      // different token there.
      if (destinationToken && destinationToken.id === balance.id) {
        setDestinationToken(null);
      }
      setSourceToken(balance.id, balance.tokenCode ?? "");
    } else {
      analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
        tokenCode: balance.tokenCode ?? "",
        isNew: descriptor.isNew,
        source,
      });
      // Selection-swap rule (spec §12.4): if the new destination equals
      // the current source, clear source so the user can pick a different
      // token there.
      if (sourceTokenId && sourceTokenId === descriptor.id) {
        setSourceToken("", "");
      }
      setDestinationToken(descriptor);
    }
    navigation.goBack();
  };

  // Non-held tokens only appear in destination mode (popularTokens / non-held
  // search results). The source picker lists held tokens only, so this handler
  // is always destination-mode.
  const handleRecordPress = (
    record: FormattedSearchTokenRecord,
    source: "popular" | "search",
  ) => {
    const descriptor = descriptorFromSearchRecord(record);
    analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
      tokenCode: record.tokenCode,
      isNew: descriptor.isNew,
      source,
    });
    // Selection-swap rule (spec §12.4): if the new destination equals the
    // current source, clear source.
    if (sourceTokenId && sourceTokenId === descriptor.id) {
      setSourceToken("", "");
    }
    setDestinationToken(descriptor);
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
    return recordTokenId(item);
  };

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <View className="px-4 pt-4 pb-2">
        <Input
          placeholder={t("swapScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={handleSearch}
          fieldSize="lg"
          autoCapitalize="none"
          autoCorrect={false}
          leftElement={
            <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          }
        />
      </View>

      {stellarExpertDown && (
        <View className="px-4 py-2">
          <Text sm secondary>
            {t("swapScreen.stellarExpertDown")}
          </Text>
        </View>
      )}

      {isSearching && (
        <View className="items-center py-8">
          <Spinner size="large" testID="search-loading-spinner" />
        </View>
      )}

      {showSorobanEmpty && (
        <View className="px-4 py-8">
          <Text sm secondary>
            {t("swapScreen.sorobanEmptyState")}
          </Text>
        </View>
      )}

      {showNoResults && (
        <View className="px-4 py-8">
          <Text sm secondary>
            {t("swapScreen.noResults", { term: searchTerm })}
          </Text>
        </View>
      )}

      {!isSearching && !showSorobanEmpty && !showNoResults && (
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
            const isSearchActive = !!searchTerm;

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
                  onPress={() => handleHeldPress(item, "balances")}
                />
              );
            }

            // For Results section: check if the record matches a held balance
            if (!isHeldToken(item)) {
              const record = item;
              const heldMatch = balanceItems.find(
                (b) =>
                  b.id === recordTokenId(record) ||
                  (record.isNative && b.id === "native"),
              );

              if (heldMatch) {
                return (
                  <SwapTokenRow
                    variant="held"
                    balance={heldMatch}
                    network={network}
                    onPress={() =>
                      handleHeldPress(
                        heldMatch,
                        isSearchActive ? "search" : "popular",
                      )
                    }
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
                  onPress={() =>
                    handleRecordPress(
                      record,
                      isSearchActive ? "search" : "popular",
                    )
                  }
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
                  onPress={() => handleHeldPress(item, "balances")}
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
