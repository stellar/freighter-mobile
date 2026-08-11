/* eslint-disable react/no-unused-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { DefaultListFooter } from "components/DefaultListFooter";
import RefreshCard from "components/RefreshCard";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionDetails } from "components/screens/HistoryScreen";
import HistoryItem from "components/screens/HistoryScreen/HistoryItem";
import HistoryWrapper from "components/screens/HistoryScreen/HistoryWrapper";
import MonthHeader from "components/screens/HistoryScreen/MonthHeader";
import {
  TransactionDetailsBottomSheetCustomContent,
  TransactionDetailsFooter,
} from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import { TransactionDetailsV2 } from "components/screens/HistoryScreen/TransactionDetailsV2";
// THROWAWAY: mapV2EntryToHistoryItemData and the v2 branch below go away in
// Phase B, when this list renders HistoryEntry directly instead of bridging
// it onto the v1 HistoryItemData shape.
import { mapV2EntryToHistoryItemData } from "components/screens/HistoryScreen/mappers/v2Entry";
import { HistoryItemData } from "components/screens/HistoryScreen/types";
import { NetworkDetails } from "config/constants";
import { HistoryEntry } from "helpers/history/v2/model";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import {
  HistorySection,
  HistoryData,
  HistorySectionV2,
  HistoryDataV2,
} from "hooks/useGetHistoryData";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  SectionList,
  View,
  SectionListData,
  useWindowDimensions,
} from "react-native";
import { analytics } from "services/analytics";

/**
 * Type for the operation data
 */
interface Operation {
  id: string;
  [key: string]: any;
}

/**
 * THROWAWAY: one row of a v2 section — the raw entry plus its pre-built
 * HistoryItemData, computed once here rather than inside HistoryItem's
 * per-row effect (see the historyItemData prop on HistoryItemProps). Goes
 * away with the rest of the v2 adapter in Phase B.
 */
interface V2Row {
  entry: HistoryEntry;
  historyItemData: HistoryItemData;
}

type SectionItem = Operation | V2Row;

/** Discriminates the two row shapes SectionList can be handed. */
const isV2Row = (item: SectionItem): item is V2Row => "entry" in item;

/** Discriminates the two section shapes getFilteredHistoryData can return,
 *  by inspecting a section rather than the top-level HistoryData/HistoryDataV2
 *  object (which are structurally identical at that level — both are just
 *  `{ balances, history }`). */
const isV2Section = (
  section: HistorySection | HistorySectionV2,
): section is HistorySectionV2 => "entries" in section;

interface HistoryListProps {
  historyData: HistoryData | HistoryDataV2 | null;
  isLoading: boolean;
  error: string | null;
  publicKey: string;
  networkDetails: NetworkDetails;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isNavigationRefresh?: boolean;
  ListHeaderComponent?: React.ReactElement;
  ignoreTopInset?: boolean;
  noHorizontalPadding?: boolean;
  className?: string;
  refreshActionPosition: "start" | "center" | "end";
}

/**
 * Shared component for rendering history lists with transactions
 */
const HistoryList: React.FC<HistoryListProps> = ({
  historyData,
  isLoading,
  error,
  publicKey,
  networkDetails,
  onRefresh,
  isRefreshing = false,
  isNavigationRefresh = false,
  ListHeaderComponent,
  ignoreTopInset = false,
  noHorizontalPadding = false,
  className,
  refreshActionPosition = "center",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
  // THROWAWAY: v2Entry and the branch below go away with the rest of the
  // adapter in Phase B, when a v2 row opens a sheet built for HistoryEntry
  // directly rather than through this second piece of state. Not a second
  // BottomSheet — both this and transactionDetails feed the same modal ref
  // and customContent below, and every setter clears the other field so the
  // two can never both be non-null (the same both-fields discipline the
  // history duck uses for rawHistoryData/rawHistoryV2Data).
  const [v2Entry, setV2Entry] = useState<HistoryEntry | null>(null);
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const sectionListRef = useRef<SectionList>(null);

  // Custom refresh indicator for navigation refreshes
  const CustomRefreshIndicator = useCallback(() => {
    if (!isNavigationRefresh) return null;

    return (
      <View className="bg-white/80 backdrop-blur-sm">
        <View className="flex-row justify-center items-center py-3">
          <Spinner size="large" />
        </View>
      </View>
    );
  }, [isNavigationRefresh]);

  const handleTransactionDetails = useCallback(
    (transactionDetail: TransactionDetails) => {
      setTransactionDetails(transactionDetail);
      // Clears the other payload so the v1 and v2 sheet states can never
      // both be set (see the v2Entry declaration above).
      setV2Entry(null);
      transactionDetailsBottomSheetModalRef.current?.present();
      analytics.trackHistoryOpenItem("history_list");
    },
    [],
  );

  // THROWAWAY: goes away with the rest of the adapter in Phase B.
  const handleV2TransactionDetails = useCallback((entry: HistoryEntry) => {
    setV2Entry(entry);
    // Clears the other payload so the v1 and v2 sheet states can never both
    // be set (see the v2Entry declaration above).
    setTransactionDetails(null);
    transactionDetailsBottomSheetModalRef.current?.present();
    analytics.trackHistoryOpenItem("history_list");
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<SectionItem> }) => (
      <MonthHeader month={section.title} />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      // THROWAWAY: v2 rows carry their HistoryItemData pre-built (see
      // mapV2EntryToHistoryItemData in the sections memo below), so
      // HistoryItem skips its own mapHistoryItemData effect for them —
      // goes away with the rest of the adapter in Phase B.
      if (isV2Row(item)) {
        return (
          <HistoryItem
            key={item.entry.id}
            operation={item.entry}
            historyItemData={item.historyItemData}
            accountBalances={historyData?.balances || {}}
            networkDetails={networkDetails}
            publicKey={publicKey}
            handleTransactionDetails={handleTransactionDetails}
            handleV2TransactionDetails={handleV2TransactionDetails}
          />
        );
      }

      return (
        <HistoryItem
          key={item.id}
          operation={item}
          accountBalances={historyData?.balances || {}}
          networkDetails={networkDetails}
          publicKey={publicKey}
          handleTransactionDetails={handleTransactionDetails}
          handleV2TransactionDetails={handleV2TransactionDetails}
        />
      );
    },
    [
      publicKey,
      historyData?.balances,
      handleTransactionDetails,
      handleV2TransactionDetails,
      networkDetails,
    ],
  );

  const keyExtractor = useCallback(
    (item: SectionItem) => (isV2Row(item) ? item.entry.id : item.id.toString()),
    [],
  );

  // Renders on both the v1 and v2 paths. HistoryEntry.id IS the transaction
  // hash (see helpers/history/v2/model.ts), so the v2 path builds its
  // externalUrl the same way TransactionDetailsBottomSheet.tsx already does
  // for its own explorer link: `${getStellarExpertUrl(network)}/tx/${hash}`.
  // (A prior version of this comment claimed the v2 model had no
  // externalUrl to build a footer from and disabled the footer entirely on
  // that path — that premise was false; HistoryEntry.id was always the hash.)
  const renderFooterComponent = useCallback(
    () => (
      <TransactionDetailsFooter
        externalUrl={
          v2Entry
            ? `${getStellarExpertUrl(networkDetails.network)}/tx/${v2Entry.id}`
            : (transactionDetails?.externalUrl ?? "")
        }
      />
    ),
    [transactionDetails?.externalUrl, v2Entry, networkDetails.network],
  );

  // THROWAWAY: the v2 branch (mapping each entry through
  // mapV2EntryToHistoryItemData up front) goes away in Phase B along with
  // the rest of the adapter, leaving only the v1 branch below unchanged.
  // Computed unconditionally (before the isLoading/error early returns)
  // because it's a hook — calling it after a conditional return would
  // violate the rules of hooks on whichever render takes that branch.
  const sections = useMemo(() => {
    if (!historyData || historyData.history.length === 0) {
      return [];
    }

    const [firstSection] = historyData.history;

    if (isV2Section(firstSection)) {
      const v2History = historyData.history as HistorySectionV2[];
      return v2History.map((historyMonth) => ({
        title: historyMonth.monthYear,
        data: historyMonth.entries.map(
          (entry): V2Row => ({
            entry,
            historyItemData: mapV2EntryToHistoryItemData(entry, themeColors),
          }),
        ),
      }));
    }

    const v1History = historyData.history as HistorySection[];
    return v1History.map((historyMonth) => ({
      title: historyMonth.monthYear,
      data: historyMonth.operations,
    }));
  }, [historyData, themeColors]);

  const getEmptyListClasses = (
    position: "start" | "center" | "end",
  ): string => {
    switch (position) {
      case "start":
        return "flex-1 flex-row justify-start items-start mt-2";
      case "end":
        return "flex-1 flex-row justify-end items-end mt-2";
      case "center":
      default:
        return "flex-1 flex-row justify-center items-center mt-2";
    }
  };

  const insets = {
    bottom: false,
    top: !ignoreTopInset,
    left: !noHorizontalPadding,
    right: !noHorizontalPadding,
  };

  if (isLoading) {
    return (
      <BaseLayout insets={insets}>
        {ListHeaderComponent}
        <HistoryWrapper>
          <Spinner size="large" testID="spinner" />
        </HistoryWrapper>
      </BaseLayout>
    );
  }

  if (error) {
    return (
      <BaseLayout insets={insets}>
        {ListHeaderComponent}
        <HistoryWrapper text={t("history.error")} />
      </BaseLayout>
    );
  }

  if (sections.length === 0) {
    return (
      <BaseLayout insets={insets}>
        {ListHeaderComponent}
        <View className={getEmptyListClasses(refreshActionPosition)}>
          <HistoryWrapper
            text={t("history.emptyState.title")}
            isLoading={isRefreshing}
            refreshFunction={onRefresh}
          />
        </View>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout insets={insets}>
      <BottomSheet
        modalRef={transactionDetailsBottomSheetModalRef}
        handleCloseModal={() =>
          transactionDetailsBottomSheetModalRef.current?.dismiss()
        }
        scrollable
        useInsetsBottomPadding={false}
        maxDynamicContentSize={windowHeight * 0.9}
        customContent={
          v2Entry ? (
            // key is load-bearing, not decorative: TransactionDetailsV2 owns
            // its own view state (detail/advanced/dataEntry) in useState.
            // Without a key tied to the entry's identity, pressing a
            // different v2 row while this component is already mounted (the
            // sheet re-presents onto the SAME component instance, since
            // customContent is just a prop, not a remount trigger) would
            // update `entry` but preserve whatever sub-view the PREVIOUS
            // entry had navigated into — showing one transaction's
            // data-entry/advanced view under a different transaction's data.
            // Keying on entry.id forces React to unmount and remount on
            // every entry change, so the reset is guaranteed by React's own
            // reconciliation rules instead of resting on
            // @gorhom/bottom-sheet happening to unmount on dismiss.
            <TransactionDetailsV2 key={v2Entry.id} entry={v2Entry} />
          ) : (
            <TransactionDetailsBottomSheetCustomContent
              transactionDetails={transactionDetails!}
            />
          )
        }
        // Renders on both paths now — renderFooterComponent above branches
        // on v2Entry itself to build the right externalUrl.
        scrollViewFooterComponent={renderFooterComponent}
      />

      <View className="flex-1 relative">
        <CustomRefreshIndicator />
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          alwaysBounceVertical={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing && !isNavigationRefresh}
              onRefresh={onRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, minHeight: "100%" }}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={DefaultListFooter}
          className={className}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-2 gap-4">
              <RefreshCard
                title={t("history.emptyState.title")}
                onRefresh={onRefresh}
                actionTitle={t("history.refresh")}
                loadingTitle={t("history.refreshing")}
                isLoading={isRefreshing}
              />
            </View>
          }
        />
      </View>
    </BaseLayout>
  );
};

export default HistoryList;
