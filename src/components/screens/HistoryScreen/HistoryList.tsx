/* eslint-disable react/no-unused-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionDetails } from "components/screens/HistoryScreen";
import HistoryItem from "components/screens/HistoryScreen/HistoryItem";
import HistoryWrapper from "components/screens/HistoryScreen/HistoryWrapper";
import MonthHeader from "components/screens/HistoryScreen/MonthHeader";
import { TransactionDetailsBottomSheetCustomContent } from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { NetworkDetails } from "config/constants";
import { HookStatus } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { HistorySection } from "hooks/useGetHistoryData";
import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import { analytics } from "services/analytics";

/**
 * Type for the operation data
 */
interface Operation {
  id: string;
  [key: string]: any;
}

interface HistoryData {
  balances: any;
  history: HistorySection[];
}

interface HistoryListProps {
  historyData: HistoryData | null;
  status: HookStatus;
  publicKey: string;
  networkDetails: NetworkDetails;
  onRefresh: () => void;
  ListHeaderComponent?: React.ReactElement;
  ignoreTopInset?: boolean;
  noHorizontalPadding?: boolean;
  className?: string;
}

/**
 * Shared component for rendering history lists with transactions
 */
const HistoryList: React.FC<HistoryListProps> = ({
  historyData,
  status,
  publicKey,
  networkDetails,
  onRefresh,
  ListHeaderComponent,
  ignoreTopInset = false,
  noHorizontalPadding = false,
  className,
}) => {
  const { t } = useAppTranslation();
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handleTransactionDetails = useCallback(
    (transactionDetail: TransactionDetails) => {
      setTransactionDetails(transactionDetail);

      transactionDetailsBottomSheetModalRef.current?.present();

      analytics.trackHistoryOpenItem(transactionDetail.operation.id);
    },
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
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

  const insets = {
    bottom: false,
    top: !ignoreTopInset,
    left: !noHorizontalPadding,
    right: !noHorizontalPadding,
  };

  if (status === HookStatus.LOADING || status === HookStatus.IDLE) {
    return (
      <BaseLayout insets={insets}>
        {ListHeaderComponent}
        <HistoryWrapper>
          <Spinner testID="spinner" />
        </HistoryWrapper>
      </BaseLayout>
    );
  }

  if (status === HookStatus.ERROR) {
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
        <HistoryWrapper
          text={t("history.emptyState.title")}
          isLoading={status === HookStatus.REFRESHING}
          refreshFunction={onRefresh}
        />
      </BaseLayout>
    );
  }

  return (
    <BaseLayout insets={insets}>
      <BottomSheet
        modalRef={transactionDetailsBottomSheetModalRef}
        title={t("manageAssetsScreen.moreInfo.title")}
        description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
        handleCloseModal={() =>
          transactionDetailsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <TransactionDetailsBottomSheetCustomContent
            transactionDetails={transactionDetails}
          />
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        alwaysBounceVertical={false}
        refreshControl={
          <RefreshControl
            refreshing={status === HookStatus.REFRESHING}
            onRefresh={onRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={<View className="h-10" />}
        className={className}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-2 gap-4">
            <Text lg primary semiBold>
              {t("history.emptyState.title")}
            </Text>
            <Button
              primary
              lg
              isLoading={status === HookStatus.REFRESHING}
              onPress={onRefresh}
            >
              {status === HookStatus.REFRESHING
                ? t("history.refreshing")
                : t("history.refresh")}
            </Button>
          </View>
        }
      />
    </BaseLayout>
  );
};

export default HistoryList;
