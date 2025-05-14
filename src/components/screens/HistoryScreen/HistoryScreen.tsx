/* eslint-disable react/no-unused-prop-types */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import { TransactionDetails } from "components/screens/HistoryScreen";
import HistoryItem from "components/screens/HistoryScreen/HistoryItem";
import { TransactionDetailsBottomSheetCustomContent } from "components/screens/HistoryScreen/TransactionDetailsBottomSheetCustomContent";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { getMonthLabel } from "helpers/date";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshControl, View, SectionList } from "react-native";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

/**
 * Type for the operation data
 */
interface Operation {
  id: string;
  [key: string]: any;
}

/**
 * Renders the empty or error state when no transactions are available
 */
const HistoryWrapper: React.FC<{
  text?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
  refreshFunction?: () => void;
}> = ({ text, children, isLoading, refreshFunction }) => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false }}>
      <View className="flex-1 items-center justify-center px-2 gap-4">
        {children}
        {text && (
          <Text lg primary semiBold>
            {text}
          </Text>
        )}
        {refreshFunction && (
          <Button primary lg isLoading={isLoading} onPress={refreshFunction}>
            {isLoading ? t("history.refreshing") : t("history.refresh")}
          </Button>
        )}
      </View>
    </BaseLayout>
  );
};

/**
 * Renders the month heading for transaction sections
 */
const MonthHeader = React.memo(({ month }: { month: string }) => (
  <View className="mb-6">
    <Text lg primary medium>
      {getMonthLabel(Number(month.split(":")[0]))}
    </Text>
  </View>
));

MonthHeader.displayName = "MonthHeader";

/**
 * Main History Screen component
 */
const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );
  const { historyData, fetchData, status } = useGetHistoryData(
    account?.publicKey ?? "",
    networkDetails,
  );
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
  const transactionDetailsBottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (!account?.publicKey) {
        return;
      }

      await fetchData({
        isRefresh: false,
      });
    };

    loadHistory();
  }, [account?.publicKey, network]);

  const handleTransactionDetails = useCallback(
    (transactionDetail: TransactionDetails) => {
      setTransactionDetails(transactionDetail);
      transactionDetailsBottomSheetModalRef.current?.present();
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

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
        publicKey={account?.publicKey ?? ""}
        handleTransactionDetails={handleTransactionDetails}
      />
    ),
    [
      account?.publicKey,
      historyData?.balances,
      handleTransactionDetails,
      networkDetails,
    ],
  );

  const keyExtractor = useCallback((item: Operation) => item.id.toString(), []);

  // Loading state
  if (status === HookStatus.LOADING || status === HookStatus.IDLE) {
    return (
      <HistoryWrapper>
        <Spinner testID="spinner" />
      </HistoryWrapper>
    );
  }

  // Error state
  if (status === HookStatus.ERROR) {
    return <HistoryWrapper text={t("history.error")} />;
  }

  // Empty state
  if (historyData?.history.length === 0 || !historyData) {
    return (
      <HistoryWrapper
        text={t("history.emptyState.title")}
        isLoading={status === HookStatus.REFRESHING}
        refreshFunction={handleRefresh}
      />
    );
  }

  // Prepare data for SectionList
  const sections = historyData.history.map((historyMonth) => ({
    title: historyMonth.monthYear,
    data: historyMonth.operations,
  }));

  return (
    <BaseLayout insets={{ bottom: false }}>
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
            onRefresh={handleRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </BaseLayout>
  );
};

export default HistoryScreen;
