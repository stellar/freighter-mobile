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
import { TransactionDetailsBottomSheetCustomContent } from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import { NetworkDetails } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { HistorySection, HistoryData } from "hooks/useGetHistoryData";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  SectionList,
  View,
  SectionListData,
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
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
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
      analytics.trackHistoryOpenItem(transactionDetail.operation.id);
    },
    [],
  );

  useEffect(() => {
    if (transactionDetails) {
      transactionDetailsBottomSheetModalRef.current?.present();
    }
  }, [transactionDetails]);

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

  const getEmptyListClasses = (
    position: "start" | "center" | "end",
  ): string => {
    switch (position) {
      case "start":
        return "flex-1 justify-start items-start";
      case "end":
        return "flex-1 justify-end items-end";
      case "center":
      default:
        return "flex-1 justify-center items-center";
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

  const sections =
    historyData?.history.map((historyMonth: HistorySection) => ({
      title: historyMonth.monthYear,
      data: historyMonth.operations,
    })) || [];

  if (sections.length === 0) {
    return (
      <BaseLayout insets={insets}>
        {ListHeaderComponent}
        <View
          style={{ flex: 1 }}
          className={getEmptyListClasses(refreshActionPosition)}
        >
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
        customContent={
          <TransactionDetailsBottomSheetCustomContent
            transactionDetails={transactionDetails!}
          />
        }
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
