/* eslint-disable react-hooks/exhaustive-deps */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import BigNumber from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from "components/screens/HistoryScreen";
import HistoryItem from "components/screens/HistoryScreen/HistoryItem";
import {
  renderActionIcon,
  renderIconComponent,
} from "components/screens/HistoryScreen/helpers";
import Avatar, { AvatarSizes } from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { AssetTypeWithCustomToken, HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { formatDate, getMonthLabel } from "helpers/date";
import { formatAssetAmount, stroopToXlm } from "helpers/formatAmount";
import { formatTokenAmount } from "helpers/soroban";
import { truncatePublicKey } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, RefreshControl, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

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

const TransactionDetailsContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <View
    className={`flex-1 justify-center bg-background-tertiary rounded-2xl p-6 gap-3 ${className}`}
  >
    {children}
  </View>
);

const CreateAccountTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { t } = useAppTranslation();

  return (
    <TransactionDetailsContent className="justify-center">
      <View className="flex-row justify-between items-center">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {truncatePublicKey({
              publicKey:
                transactionDetails.createAccountDetails?.accountPublicKey ?? "",
              length: 4,
            })}
          </Text>
          <Text sm secondary numberOfLines={1}>
            {t("history.transactionDetails.startingBalance")}{" "}
            {formatAssetAmount(
              transactionDetails.createAccountDetails?.startingBalance ?? "",
              "XLM",
            )}
          </Text>
        </View>
        <Avatar
          publicAddress={
            transactionDetails.createAccountDetails?.accountPublicKey ?? ""
          }
          hasBorder
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};

const SwapTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();

  return (
    <TransactionDetailsContent>
      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {transactionDetails.swapDetails?.sourceAmount}{" "}
            {transactionDetails.swapDetails?.sourceAssetCode}
          </Text>
          <Text md secondary numberOfLines={1}>
            $15.11
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.swapDetails?.sourceAssetCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.sourceAssetIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.sourceAssetType as AssetTypeWithCustomToken,
          }}
        />
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {transactionDetails.swapDetails?.destinationAmount}{" "}
            {transactionDetails.swapDetails?.destinationAssetCode}
          </Text>
          <Text md secondary numberOfLines={1}>
            $15.11
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.swapDetails?.destinationAssetCode ?? "",
            issuer: {
              key: transactionDetails.swapDetails?.destinationAssetIssuer ?? "",
            },
            type: transactionDetails.swapDetails
              ?.destinationAssetType as AssetTypeWithCustomToken,
          }}
        />
      </View>
    </TransactionDetailsContent>
  );
};

export const SendTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return (
    <TransactionDetailsContent>
      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {transactionDetails.paymentDetails?.amount}{" "}
            {transactionDetails.paymentDetails?.assetCode}
          </Text>
          <Text md secondary numberOfLines={1}>
            $15.11
          </Text>
        </View>
        <AssetIcon
          token={{
            code: transactionDetails.paymentDetails?.assetCode ?? "",
            issuer: {
              key: transactionDetails.paymentDetails?.assetIssuer ?? "",
            },
            type: transactionDetails.paymentDetails
              ?.assetType as AssetTypeWithCustomToken,
          }}
        />
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {truncatePublicKey({
              publicKey: transactionDetails.paymentDetails?.to ?? "",
              length: 4,
            })}
          </Text>
          <Text md secondary numberOfLines={1}>
            {t("history.transactionDetails.firstTimeSend")}
          </Text>
        </View>
        <Avatar
          publicAddress={transactionDetails.paymentDetails?.to ?? ""}
          hasBorder
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};

export const SorobanTransferTransactionDetailsContent: React.FC<{
  transactionDetails: TransactionDetails;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const tokenAmount = formatTokenAmount(
    new BigNumber(
      transactionDetails.contractDetails?.transferDetails?.amount ?? "",
    ),
    transactionDetails.contractDetails?.contractDecimals ?? 0,
  );

  return (
    <TransactionDetailsContent>
      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {tokenAmount} {transactionDetails.contractDetails?.contractSymbol}
          </Text>
          <Text md secondary numberOfLines={1}>
            $15.11
          </Text>
        </View>
        <AssetIcon
          token={{
            type: AssetTypeWithCustomToken.CUSTOM_TOKEN,
            code: transactionDetails.contractDetails?.contractSymbol ?? "",
            issuer: {
              key: "",
            },
          }}
          size="lg"
        />
      </View>

      <Icon.ChevronDownDouble
        size={20}
        color={themeColors.foreground.primary}
        circle
        circleBackground={themeColors.background.tertiary}
      />

      <View className="flex-row justify-between">
        <View>
          <Text xl primary medium numberOfLines={1}>
            {truncatePublicKey({
              publicKey:
                transactionDetails.contractDetails?.transferDetails?.to ?? "",
              length: 4,
            })}
          </Text>
          <Text md secondary numberOfLines={1}>
            {t("history.transactionDetails.firstTimeSend")}
          </Text>
        </View>
        <Avatar
          publicAddress={
            transactionDetails.contractDetails?.transferDetails?.to ?? ""
          }
          hasBorder
          size={AvatarSizes.LARGE}
        />
      </View>
    </TransactionDetailsContent>
  );
};

export const TransactionDetailsBottomSheetCustomContent: React.FC<{
  transactionDetails: TransactionDetails | null;
}> = ({ transactionDetails }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  if (!transactionDetails) {
    return null;
  }

  const fee = stroopToXlm(transactionDetails.fee).toString();
  const formattedDate = formatDate({
    date: transactionDetails?.operation.created_at ?? "",
    includeTime: true,
  });
  const isSuccess = transactionDetails.status === TransactionStatus.SUCCESS;

  return (
    <View className="flex-1 justify-center gap-6">
      <View className="flex-row items-center flex-1">
        {renderIconComponent({
          iconComponent: transactionDetails.IconComponent as React.ReactElement,
          themeColors,
        })}
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {transactionDetails.transactionTitle}
          </Text>
          <View className="flex-row items-center gap-1">
            {renderActionIcon({
              actionIcon:
                transactionDetails.ActionIconComponent as React.ReactElement,
              themeColors,
            })}
            <Text sm secondary numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>

      {transactionDetails.transactionType ===
        TransactionType.CREATE_ACCOUNT && (
        <CreateAccountTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType === TransactionType.SWAP && (
        <SwapTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType === TransactionType.PAYMENT && (
        <SendTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      {transactionDetails.transactionType ===
        TransactionType.CONTRACT_TRANSFER && (
        <SorobanTransferTransactionDetailsContent
          transactionDetails={transactionDetails}
        />
      )}

      <View className="flex-1 justify-center bg-background-primary rounded-2xl p-6 gap-3 border border-border-primary">
        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.status")}
            </Text>
          </View>
          <Text
            md
            primary
            numberOfLines={1}
            color={
              isSuccess ? themeColors.status.success : themeColors.status.error
            }
          >
            {isSuccess
              ? t("history.transactionDetails.statusSuccess")
              : t("history.transactionDetails.statusFailed")}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.rate")}
            </Text>
          </View>
          <Text md primary numberOfLines={1}>
            {/* TODO: formate rate */}-
          </Text>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-row items-center justify-center gap-2">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md secondary medium numberOfLines={1}>
              {t("history.transactionDetails.fee")}
            </Text>
          </View>
          <Text md primary numberOfLines={1}>
            {fee} XLM
          </Text>
        </View>
      </View>
      <Button
        isFullWidth
        tertiary
        lg
        icon={<Icon.LinkExternal01 size={16} color={themeColors.base[0]} />}
        onPress={() => {
          Linking.openURL(transactionDetails.externalUrl);
        }}
      >
        {t("history.transactionDetails.viewOnStellarExpert")}
      </Button>
    </View>
  );
};

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
  }, [account?.publicKey]);

  if (status === HookStatus.LOADING || status === HookStatus.IDLE) {
    return (
      <HistoryWrapper>
        <Spinner />
      </HistoryWrapper>
    );
  }

  if (status === HookStatus.ERROR) {
    return <HistoryWrapper text={t("history.error")} />;
  }

  if (historyData?.history.length === 0 || !historyData) {
    return (
      <HistoryWrapper
        text={t("history.emptyState.title")}
        isLoading={status === HookStatus.REFRESHING}
        refreshFunction={() => {
          fetchData({ isRefresh: true });
        }}
      />
    );
  }

  const handleTransactionDetails = (transactionDetail: TransactionDetails) => {
    setTransactionDetails(transactionDetail);
    transactionDetailsBottomSheetModalRef.current?.present();
  };

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
      <ScrollView
        className="flex-1"
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={status === HookStatus.REFRESHING}
            onRefresh={() => {
              fetchData({
                isRefresh: true,
              });
            }}
          />
        }
      >
        {status === HookStatus.SUCCESS &&
          historyData?.history.map((history) => (
            <View key={history.monthYear}>
              <View className="mb-6">
                <Text lg primary medium>
                  {getMonthLabel(Number(history.monthYear.split(":")[0]))}
                </Text>
              </View>
              {history.operations.map((operation) => (
                <HistoryItem
                  key={operation.id}
                  operation={operation}
                  accountBalances={historyData.balances}
                  networkDetails={networkDetails}
                  publicKey={account?.publicKey ?? ""}
                  handleTransactionDetails={handleTransactionDetails}
                />
              ))}
            </View>
          ))}
      </ScrollView>
    </BaseLayout>
  );
};

export default HistoryScreen;
