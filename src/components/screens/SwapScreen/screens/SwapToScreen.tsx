/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { UnverifiedTokenInfoBottomSheet } from "components/screens/SwapScreen/components/UnverifiedTokenInfoBottomSheet";
import { VerifiedTokenInfoBottomSheet } from "components/screens/SwapScreen/components/VerifiedTokenInfoBottomSheet";
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
import React, { useMemo, useRef } from "react";
import { SectionList, TouchableOpacity, View } from "react-native";
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
    heldSearchMatches,
    verifiedSearchMatches,
    unverifiedSearchMatches,
    hadSorobanMatches,
    stellarExpertDown,
    status,
    searchTerm,
    handleSearch,
  } = useSwapTokenLookup({
    network,
    publicKey: account?.publicKey,
    balanceItems,
    // "Swap from" picker only chooses among held tokens — skip the
    // trending fetch and the per-keystroke stellar.expert search so
    // typing in the search box stays instant.
    holdsOnly: selectionType === SWAP_SELECTION_TYPES.SOURCE,
  });

  const verifiedInfoSheetRef = useRef<BottomSheetModal>(null);
  const unverifiedInfoSheetRef = useRef<BottomSheetModal>(null);

  // Section.kind drives both the header and the row variant for that section
  // — keeping title resolution (singular / plural) decoupled from row logic
  // so renderItem doesn't need to match against translated strings.
  type SectionKind = "held" | "popular" | "verified" | "unverified";

  // Section data: idle = "Your tokens" + "Popular tokens"; active = three
  // sections ("Your tokens" / "Verified" / "Unverified") — each omitted when
  // its bucket is empty. The opposite-side token is NOT excluded here —
  // picking it triggers the selection-swap rule (spec §12.4): the opposite
  // side clears so the user can pick a different token there.
  const sections = useMemo(() => {
    type SwapSection = {
      title: string;
      kind: SectionKind;
      data: Array<
        (PricedBalance & { id: string }) | FormattedSearchTokenRecord
      >;
    };
    const out: SwapSection[] = [];

    // "Your token" (singular) when exactly one row is in the bucket — switches
    // to "Your tokens" otherwise.
    const heldTitle = (count: number) =>
      count === 1
        ? t("swapScreen.yourTokenSection")
        : t("swapScreen.yourTokensSection");

    if (searchTerm) {
      if (heldSearchMatches.length > 0) {
        out.push({
          title: heldTitle(heldSearchMatches.length),
          kind: "held",
          data: heldSearchMatches,
        });
      }
      if (verifiedSearchMatches.length > 0) {
        out.push({
          title: t("swapScreen.verifiedSection"),
          kind: "verified",
          data: verifiedSearchMatches,
        });
      }
      if (unverifiedSearchMatches.length > 0) {
        out.push({
          title: t("swapScreen.unverifiedSection"),
          kind: "unverified",
          data: unverifiedSearchMatches,
        });
      }
      return out;
    }

    if (yourTokens.length > 0) {
      out.push({
        title: heldTitle(yourTokens.length),
        kind: "held",
        data: yourTokens,
      });
    }

    if (
      popularTokens.length > 0 &&
      selectionType === SWAP_SELECTION_TYPES.DESTINATION
    ) {
      out.push({
        title: t("swapScreen.popularTokensSection"),
        kind: "popular",
        data: popularTokens,
      });
    }

    return out;
  }, [
    searchTerm,
    heldSearchMatches,
    verifiedSearchMatches,
    unverifiedSearchMatches,
    yourTokens,
    popularTokens,
    selectionType,
    t,
  ]);

  // Total active-search result count across all three buckets — used to gate
  // the loading / empty-state branches the same way the old flat
  // searchResults.length did.
  const totalSearchResults =
    heldSearchMatches.length +
    verifiedSearchMatches.length +
    unverifiedSearchMatches.length;

  // True while the user's debounced search is fetching (takes precedence over
  // empty-state branches so the user doesn't see "no results" mid-fetch).
  const isSearching =
    searchTerm.length > 0 &&
    status === HookStatus.LOADING &&
    totalSearchResults === 0;

  // Soroban empty-state: search has term, no results, and either there were
  // Soroban matches filtered out OR the term itself looks like a contract ID.
  // Only shown when we are NOT actively fetching.
  const showSorobanEmpty =
    !isSearching &&
    searchTerm.length > 0 &&
    totalSearchResults === 0 &&
    (hadSorobanMatches || isContractId(searchTerm));

  // No-results empty-state: search has term, no results, and NOT a Soroban
  // case (which has its own dedicated message). Only shown when not fetching.
  const showNoResults =
    !isSearching &&
    searchTerm.length > 0 &&
    totalSearchResults === 0 &&
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
      <BottomSheet
        modalRef={verifiedInfoSheetRef}
        handleCloseModal={() => verifiedInfoSheetRef.current?.dismiss()}
        customContent={
          <VerifiedTokenInfoBottomSheet
            bottomSheetModalRef={verifiedInfoSheetRef}
          />
        }
      />
      <BottomSheet
        modalRef={unverifiedInfoSheetRef}
        handleCloseModal={() => unverifiedInfoSheetRef.current?.dismiss()}
        customContent={
          <UnverifiedTokenInfoBottomSheet
            bottomSheetModalRef={unverifiedInfoSheetRef}
          />
        }
      />
      <View className="px-4 pt-4">
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
      {/* 16px gap below the Input — mirrors the <View className="h-4" />
          spacer used by the Add-a-Token search box so the two pickers feel
          consistent regardless of which empty-state / list renders next. */}
      <View className="h-4" />

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
          // Default sticky headers don't match the design — the "Your tokens"
          // and "Popular tokens" titles should scroll with the rows above
          // and below them.
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderSectionHeader={({ section }) => {
            let infoRef: React.RefObject<BottomSheetModal | null> | null = null;
            if (section.kind === "verified") {
              infoRef = verifiedInfoSheetRef;
            } else if (section.kind === "unverified") {
              infoRef = unverifiedInfoSheetRef;
            }
            if (infoRef) {
              // Tappable region spans the whole header (title + (i)) so the
              // user doesn't have to hit the small 16px icon. 16-top / 24-bot
              // matches the Figma spec and Add-a-Token's section-title spacing.
              return (
                <TouchableOpacity
                  className="mt-4 mb-6 flex-row items-center gap-2 self-start"
                  hitSlop={10}
                  onPress={() => infoRef.current?.present()}
                  testID={`swap-to-${section.kind}-info-button`}
                >
                  <Text md medium secondary>
                    {section.title}
                  </Text>
                  <Icon.InfoCircle
                    size={16}
                    color={themeColors.foreground.secondary}
                  />
                </TouchableOpacity>
              );
            }
            return (
              <View className="mt-4 mb-6 flex-row items-center gap-2">
                <Text md medium secondary>
                  {section.title}
                </Text>
              </View>
            );
          }}
          renderItem={({ item, section }) => {
            const isSearchActive = !!searchTerm;

            // "Your tokens" section always uses the held variant
            if (section.kind === "held" && isHeldToken(item)) {
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
