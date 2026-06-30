/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { DefaultListFooter } from "components/DefaultListFooter";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { SwapTokenRow } from "components/screens/SwapScreen/components/SwapTokenRow";
import { UnverifiedTokenInfoBottomSheet } from "components/screens/SwapScreen/components/UnverifiedTokenInfoBottomSheet";
import { VerifiedTokenInfoBottomSheet } from "components/screens/SwapScreen/components/VerifiedTokenInfoBottomSheet";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
  getItemKey,
  isHeldToken,
  recordTokenId,
} from "components/screens/SwapScreen/helpers";
import {
  useSwapToEmptyStates,
  useSwapToSections,
} from "components/screens/SwapScreen/hooks";
import { useSwapTokenLookup } from "components/screens/SwapScreen/hooks/useSwapTokenLookup";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent, SwapSelectionSource } from "config/analyticsConfig";
import { isNativeAssetId, SWAP_SELECTION_TYPES } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { FormattedSearchTokenRecord } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useRef } from "react";
import {
  InteractionManager,
  SectionList,
  TouchableOpacity,
  View,
} from "react-native";
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
  const { getClipboardText } = useClipboard();
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
    balanceItems,
    // "Swap from" picker only chooses among held tokens — skip the
    // trending fetch and the per-keystroke stellar.expert search so
    // typing in the search box stays instant.
    holdsOnly: selectionType === SWAP_SELECTION_TYPES.SOURCE,
  });

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  const verifiedInfoSheetRef = useRef<BottomSheetModal>(null);
  const unverifiedInfoSheetRef = useRef<BottomSheetModal>(null);

  const sections = useSwapToSections({
    searchTerm,
    heldSearchMatches,
    verifiedSearchMatches,
    unverifiedSearchMatches,
    yourTokens,
    popularTokens,
    selectionType,
  });

  const { isSearching, showSorobanEmpty, showNoResults } = useSwapToEmptyStates(
    {
      searchTerm,
      status,
      heldSearchMatches,
      verifiedSearchMatches,
      unverifiedSearchMatches,
      hadSorobanMatches,
    },
  );

  // Dismiss the picker, then apply the store writes after the slide
  // completes. Doing the writes synchronously re-renders the revealed amount
  // screen mid-transition, which on Android cancels the dismiss animation
  // (the flash); deferring keeps the slide smooth.
  const dismissThenApply = (apply: () => void) => {
    navigation.goBack();
    InteractionManager.runAfterInteractions(apply);
  };

  const handleHeldPress = (
    balance: HeldBalanceItem,
    source:
      | SwapSelectionSource.BALANCES
      | SwapSelectionSource.POPULAR
      | SwapSelectionSource.SEARCH,
  ) => {
    const descriptor = descriptorFromBalance(balance);
    if (selectionType === SWAP_SELECTION_TYPES.SOURCE) {
      // Source picker is holdsOnly, so `source` is either BALANCES (idle)
      // or SEARCH (active-search match against a held token). POPULAR
      // never reaches the source picker.
      const sourceSource:
        | SwapSelectionSource.BALANCES
        | SwapSelectionSource.SEARCH =
        source === SwapSelectionSource.SEARCH
          ? SwapSelectionSource.SEARCH
          : SwapSelectionSource.BALANCES;
      analytics.track(AnalyticsEvent.SWAP_SOURCE_SELECTED, {
        tokenCode: balance.tokenCode ?? "",
        tokenIssuer: descriptor.issuer ?? "",
        source: sourceSource,
      });
      dismissThenApply(() => {
        // If the new source equals the current destination, clear destination
        // so the user can pick a different token there.
        if (destinationToken && destinationToken.id === balance.id) {
          setDestinationToken(null);
        }
        // setSourceToken resets the amount on an actual token change (see the
        // swap store), preventing the prior amount from briefly tripping the
        // insufficient-balance check against the new token's balance.
        setSourceToken(balance.id, balance.tokenCode ?? "");
      });
    } else {
      analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
        tokenCode: balance.tokenCode ?? "",
        tokenIssuer: descriptor.issuer ?? "",
        requiresTrustline: descriptor.requiresTrustline,
        source,
      });
      dismissThenApply(() => {
        // If the new destination equals the current source, clear source so
        // the user can pick a different token there.
        if (sourceTokenId && sourceTokenId === descriptor.id) {
          setSourceToken("", "");
        }
        setDestinationToken(descriptor);
      });
    }
  };

  // Non-held tokens only appear in destination mode (popularTokens / non-held
  // search results). The source picker lists held tokens only, so this handler
  // is always destination-mode.
  const handleRecordPress = (
    record: FormattedSearchTokenRecord,
    source: SwapSelectionSource.POPULAR | SwapSelectionSource.SEARCH,
  ) => {
    const descriptor = descriptorFromSearchRecord(record);
    analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
      tokenCode: record.tokenCode,
      tokenIssuer: descriptor.issuer ?? "",
      requiresTrustline: descriptor.requiresTrustline,
      source,
    });
    dismissThenApply(() => {
      // If the new destination equals the current source, clear source.
      if (sourceTokenId && sourceTokenId === descriptor.id) {
        setSourceToken("", "");
      }
      setDestinationToken(descriptor);
    });
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
      <View className="pt-4">
        <Input
          placeholder={t("addTokenScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={handleSearch}
          fieldSize="lg"
          autoCapitalize="none"
          autoCorrect={false}
          leftElement={
            <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          }
          endButton={{
            content: t("common.paste"),
            onPress: handlePasteFromClipboard,
          }}
        />
      </View>
      {/* 16px gap below the Input — mirrors the <View className="h-4" />
          spacer used by the Add-a-Token search box so the two pickers feel
          consistent regardless of which empty-state / list renders next. */}
      <View className="h-4" />

      {stellarExpertDown && (
        <View className="py-2">
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
        <View className="bg-background-tertiary rounded-[12px] px-8 py-6 items-center mt-4">
          <Text sm secondary medium textAlign="center">
            {t("swapScreen.sorobanEmptyState")}
          </Text>
        </View>
      )}

      {showNoResults && (
        <View className="py-8">
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
          showsVerticalScrollIndicator={false}
          ListFooterComponent={DefaultListFooter}
          renderSectionHeader={({ section }) => {
            let infoRef: React.RefObject<BottomSheetModal | null> | null = null;
            if (section.kind === "verified") {
              infoRef = verifiedInfoSheetRef;
            } else if (section.kind === "unverified") {
              infoRef = unverifiedInfoSheetRef;
            }
            if (infoRef) {
              // Tappable region spans the whole header (title + (i)) so the
              // user doesn't have to hit the small 16px icon.
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
                  testID={`token-option-${item.tokenCode}`}
                  onPress={() =>
                    handleHeldPress(item, SwapSelectionSource.BALANCES)
                  }
                />
              );
            }

            // For Results section: check if the record matches a held balance
            if (!isHeldToken(item)) {
              const record = item;
              const heldMatch = balanceItems.find(
                (b) =>
                  b.id === recordTokenId(record) ||
                  (record.isNative && isNativeAssetId(b.id)),
              );

              if (heldMatch) {
                return (
                  <SwapTokenRow
                    variant="held"
                    balance={heldMatch}
                    network={network}
                    testID={`token-option-${heldMatch.tokenCode}`}
                    onPress={() =>
                      handleHeldPress(
                        heldMatch,
                        isSearchActive
                          ? SwapSelectionSource.SEARCH
                          : SwapSelectionSource.POPULAR,
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
                  testID={`token-option-${record.tokenCode}`}
                  onPress={() =>
                    handleRecordPress(
                      record,
                      isSearchActive
                        ? SwapSelectionSource.SEARCH
                        : SwapSelectionSource.POPULAR,
                    )
                  }
                />
              );
            }

            // Defensive: a held token leaking outside the yourTokens
            // section would mean useSwapToSections' classification went
            // out of sync with this renderer. We don't crash, but we
            // surface it during development.
            if (__DEV__ && isHeldToken(item)) {
              // eslint-disable-next-line no-console
              console.warn(
                "SwapToScreen: held token rendered outside yourTokens section",
                item,
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
