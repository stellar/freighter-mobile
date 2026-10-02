/* eslint-disable react/no-unused-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { DefaultListFooter } from "components/DefaultListFooter";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionDetails } from "components/screens/HistoryScreen";
import HistoryItem from "components/screens/HistoryScreen/HistoryItem";
import HistorySkeletonRows from "components/screens/HistoryScreen/HistorySkeletonRows";
import HistoryWrapper from "components/screens/HistoryScreen/HistoryWrapper";
import MonthHeader from "components/screens/HistoryScreen/MonthHeader";
import {
  TransactionDetailsBottomSheetCustomContent,
  TransactionDetailsFooter,
} from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import { DEFAULT_PADDING, NetworkDetails } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { HistorySection, HistoryData } from "hooks/useGetHistoryData";
import React, { useCallback, useRef, useState } from "react";
import {
  RefreshControl,
  SectionList,
  SectionListData,
  View,
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

interface HistoryListProps {
  historyData: HistoryData | null;
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
  /** The token-detail screen opts into the Figma skeleton rows; the History screen keeps its spinner. */
  loadingPlaceholder?: "spinner" | "skeleton";
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
  loadingPlaceholder = "spinner",
}) => {
  const { t } = useAppTranslation();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const sectionListRef = useRef<SectionList>(null);

  // Custom refresh indicator for navigation refreshes
  const CustomRefreshIndicator = useCallback(() => {
    if (!isNavigationRefresh) return null;

    // No background: this sits on BaseLayout, which paints the page. A
    // background of its own would be a second token that has to keep agreeing
    // with the page, and the list scrolls below it rather than under it, so
    // there is nothing for it to cover.
    return (
      <View className="flex-row justify-center items-center py-3">
        <Spinner size="large" />
      </View>
    );
  }, [isNavigationRefresh]);

  const handleTransactionDetails = useCallback(
    (transactionDetail: TransactionDetails) => {
      setTransactionDetails(transactionDetail);
      transactionDetailsBottomSheetModalRef.current?.present();
      analytics.trackHistoryOpenItem("history_list");
    },
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Operation> }) => (
      <MonthHeader month={section.title} />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Operation }) => (
      <HistoryItem
        key={item.id}
        operation={item}
        accountBalances={historyData?.balances || {}}
        networkDetails={networkDetails}
        publicKey={publicKey}
        handleTransactionDetails={handleTransactionDetails}
      />
    ),
    [
      publicKey,
      historyData?.balances,
      handleTransactionDetails,
      networkDetails,
    ],
  );

  const keyExtractor = useCallback((item: Operation) => item.id.toString(), []);

  const renderFooterComponent = useCallback(
    () => (
      <TransactionDetailsFooter
        externalUrl={transactionDetails?.externalUrl ?? ""}
      />
    ),
    [transactionDetails?.externalUrl],
  );

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

  const loadedSections =
    historyData?.history.map((historyMonth: HistorySection) => ({
      title: historyMonth.monthYear,
      data: historyMonth.operations,
    })) || [];

  /**
   * A failed refresh sets `error` but deliberately keeps `rawHistoryData`, so
   * without this the list stays non-empty — and `ListEmptyComponent` is only
   * consulted for an empty one. The failure would then be invisible: the
   * screen would go on showing the rows it had before the refresh, with
   * nothing to say they are stale. Emptying the sections is what the three
   * early returns used to do implicitly, and it is the safer read for a
   * transaction list, where a silently out-of-date balance is worse than an
   * explicit error.
   */
  const sections = error ? [] : loadedSections;

  /**
   * Loading, error and empty all render through the list's own
   * `ListEmptyComponent` rather than short-circuiting to a bare layout.
   *
   * Two reasons, both found the hard way. The element type at the header's
   * position must not change: returning a `ScrollView` while loading and a
   * `SectionList` once sections arrive makes React drop and rebuild the whole
   * header subtree — which on the token detail screen is the entire page, so
   * the chart remounted, `token_chart.viewed` fired twice, and a timeframe
   * chosen during the load was reset. And the list sizes its empty component
   * against `minHeight: "100%"`, where a `flex-1` child of a plain
   * `ScrollView` collapses to zero height once the header is taller than the
   * viewport.
   */
  const listEmptyComponent = (() => {
    if (isLoading) {
      if (loadingPlaceholder === "skeleton") {
        // Both layouts leave the page padding on each side: the outer
        // BaseLayout's when `noHorizontalPadding`, this list's own otherwise.
        return (
          <HistorySkeletonRows
            width={windowWidth - 2 * pxValue(DEFAULT_PADDING)}
          />
        );
      }
      return (
        <HistoryWrapper>
          <Spinner size="large" testID="spinner" />
        </HistoryWrapper>
      );
    }

    if (error) {
      return <HistoryWrapper text={t("history.error")} />;
    }

    return (
      <View className={getEmptyListClasses(refreshActionPosition)}>
        <HistoryWrapper
          text={t("history.emptyState.title")}
          isLoading={isRefreshing}
          refreshFunction={onRefresh}
        />
      </View>
    );
  })();

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
          <TransactionDetailsBottomSheetCustomContent
            transactionDetails={transactionDetails!}
          />
        }
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
          ListEmptyComponent={listEmptyComponent}
        />
      </View>
    </BaseLayout>
  );
};

export default HistoryList;
