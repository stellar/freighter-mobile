import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { CollectibleImage } from "components/CollectibleImage";
import { IconButton } from "components/IconButton";
import InformationBottomSheet from "components/InformationBottomSheet";
import { List, ListItemProps } from "components/List";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import SecurityDetailBottomSheet from "components/blockaid/SecurityDetailBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  ContactRow,
  SendReviewBottomSheet,
  SendReviewFooter,
} from "components/screens/SendScreen/components";
import { SendType } from "components/screens/SendScreen/components/SendReviewBottomSheet";
import {
  useSendBannerContent,
  useTransactionSecurity,
} from "components/screens/SendScreen/helpers";
import { TransactionProcessingScreen } from "components/screens/SendScreen/screens";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { TransactionContext } from "config/constants";
import { logger } from "config/logger";
import {
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  MAIN_TAB_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { useDebugStore } from "ducks/debug";
import { useHistoryStore } from "ducks/history";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useValidateTransactionMemo } from "hooks/useValidateTransactionMemo";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";
import { TransactionOperationType } from "services/analytics/types";

type SendCollectibleReviewScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW
>;

/**
 * SendCollectibleReviewScreen Component
 *
 * A screen for reviewing details of a collectible before sending.
 *
 * @param {SendCollectibleReviewScreenProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const SendCollectibleReviewScreen: React.FC<
  SendCollectibleReviewScreenProps
> = ({ navigation, route }) => {
  const { tokenId, collectionAddress } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { recipientAddress, saveSelectedCollectibleDetails, resetSettings } =
    useTransactionSettingsStore();
  const { collections } = useCollectiblesStore();
  const { overriddenBlockaidResponse } = useDebugStore();
  const { resetSendRecipient } = useSendRecipientStore();
  const { fetchAccountHistory } = useHistoryStore();

  useEffect(() => {
    if (tokenId && collectionAddress) {
      saveSelectedCollectibleDetails({ tokenId, collectionAddress });
    }
  }, [tokenId, collectionAddress, saveSelectedCollectibleDetails]);

  const {
    buildSendCollectibleTransaction,
    signTransaction,
    submitTransaction,
    resetTransaction,
    isBuilding,
    transactionXDR,
  } = useTransactionBuilderStore();

  // Reset transaction on unmount, but keep selectedCollectibleDetails
  // so navigation between Review and SearchContacts works correctly
  useEffect(
    () => () => {
      resetTransaction();
    },
    [resetTransaction],
  );

  const { isValidatingMemo } = useValidateTransactionMemo(transactionXDR);

  const { scanTransaction } = useBlockaidTransaction();

  const publicKey = account?.publicKey;
  const reviewBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const transactionSettingsBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [transactionScanResult, setTransactionScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);
  const transactionSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const signTransactionDetails = useSignTransactionDetails({
    xdr: transactionXDR ?? "",
  });

  useRightHeaderButton({
    icon: Icon.Settings04,
    onPress: () => {
      transactionSettingsBottomSheetModalRef.current?.present();
    },
  });

  const onConfirmAddMemo = useCallback(() => {
    reviewBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.present();
  }, []);

  const onCancelAddMemo = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmTransactionSettings = () => {
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const handleOpenSettingsFromReview = () => {
    transactionSettingsBottomSheetModalRef.current?.present();
  };

  const handleCancelTransactionSettings = () => {
    addMemoExplanationBottomSheetModalRef.current?.dismiss();
    transactionSettingsBottomSheetModalRef.current?.dismiss();
  };

  const navigateToSelectContactScreen = () => {
    // Use popTo to navigate back to SearchContacts
    // If SearchContacts exists in stack, pops back to it; otherwise adds it
    navigation.popTo(SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN);
  };

  const {
    transactionSecurityAssessment,
    transactionSecurityWarnings,
    transactionSecuritySeverity,
  } = useTransactionSecurity(transactionScanResult, overriddenBlockaidResponse);

  const selectedCollectible = useMemo(() => {
    const collection = collections.find(
      (c) => c.collectionAddress === collectionAddress,
    );
    if (collection) {
      return collection.items.find(
        (collectible) => collectible.tokenId === tokenId,
      );
    }
    return undefined;
  }, [collections, collectionAddress, tokenId]);

  const prepareTransaction = useCallback(
    async (shouldOpenReview = false) => {
      const hasRequiredParams =
        publicKey && recipientAddress && selectedCollectible;
      if (!hasRequiredParams) {
        return;
      }

      try {
        // Get fresh settings values each time the function is called
        const {
          transactionMemo: freshTransactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          recipientAddress: storeRecipientAddress,
        } = useTransactionSettingsStore.getState();

        const xdr = await buildSendCollectibleTransaction({
          collectionAddress: selectedCollectible.collectionAddress,
          tokenId: Number(selectedCollectible.tokenId),
          destinationAccount: storeRecipientAddress,
          transactionMemo: freshTransactionMemo,
          transactionFee: freshTransactionFee,
          transactionTimeout: freshTransactionTimeout,
          network,
          senderAddress: publicKey,
        });

        if (!xdr) return;

        if (shouldOpenReview) {
          scanTransaction(xdr, "internal")
            .then((scanResult) => {
              logger.info("TransactionAmountScreen", "scanResult", scanResult);
              setTransactionScanResult(scanResult);
            })
            .catch(() => {
              setTransactionScanResult(undefined);
            })
            .finally(() => {
              reviewBottomSheetModalRef.current?.present();
            });
        }
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Failed to build transaction:",
          error,
        );
      }
    },
    [
      selectedCollectible,
      network,
      publicKey,
      buildSendCollectibleTransaction,
      scanTransaction,
      recipientAddress,
    ],
  );

  const handleSettingsChange = () => {
    // Settings have changed, rebuild the transaction with new values
    prepareTransaction(false);
  };

  const handleTransactionConfirmation = useCallback(() => {
    setIsProcessing(true);
    reviewBottomSheetModalRef.current?.dismiss();

    const processTransaction = async () => {
      try {
        if (!account?.privateKey || !selectedCollectible || !recipientAddress) {
          throw new Error("Missing account or collectible information");
        }

        const { privateKey } = account;

        signTransaction({
          secretKey: privateKey,
          network,
        });

        const success = await submitTransaction({
          network,
        });

        if (success) {
          analytics.trackSendCollectibleSuccess({
            collectionAddress: selectedCollectible.collectionAddress,
            tokenId: selectedCollectible.tokenId,
          });
        } else {
          analytics.trackTransactionError({
            error: "Transaction failed",
            operationType: TransactionOperationType.SendCollectible,
          });
        }
      } catch (error) {
        logger.error(
          "TransactionAmountScreen",
          "Transaction submission failed:",
          error,
        );

        analytics.trackTransactionError({
          error: error instanceof Error ? error.message : String(error),
          operationType: TransactionOperationType.SendCollectible,
        });
      }
    };

    processTransaction();
  }, [
    account,
    selectedCollectible,
    signTransaction,
    network,
    submitTransaction,
    recipientAddress,
  ]);

  const handleProcessingScreenClose = () => {
    setIsProcessing(false);
    resetTransaction();
    // Clean up stores when exiting the send flow
    saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });
    resetSendRecipient();
    resetSettings();

    if (account?.publicKey) {
      fetchAccountHistory({
        publicKey: account.publicKey,
        network,
        isBackgroundRefresh: true,
        hasRecentTransaction: true,
      });
    }

    navigation.reset({
      index: 0,
      routes: [
        {
          // @ts-expect-error: Cross-stack navigation to MainTabStack with History tab
          name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
          state: {
            routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
            index: 0,
          },
        },
      ],
    });
  };

  const handleCancelSecurityWarning = () => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();
  };

  const handleCancelReview = useCallback(() => {
    reviewBottomSheetModalRef.current?.dismiss();
  }, []);

  const footerProps = useMemo(
    () => ({
      onCancel: handleCancelReview,
      onConfirm: handleTransactionConfirmation,
      isRequiredMemoMissing: false,
      isMalicious: transactionSecurityAssessment.isMalicious,
      isSuspicious: transactionSecurityAssessment.isSuspicious,
      isUnableToScan: transactionSecurityAssessment.isUnableToScan,
      isValidatingMemo,
      onSettingsPress: handleOpenSettingsFromReview,
    }),
    [
      handleCancelReview,
      transactionSecurityAssessment.isMalicious,
      transactionSecurityAssessment.isSuspicious,
      transactionSecurityAssessment.isUnableToScan,
      handleTransactionConfirmation,
      isValidatingMemo,
    ],
  );

  const renderFooterComponent = useCallback(
    () => <SendReviewFooter {...footerProps} />,
    [footerProps],
  );

  const isContinueButtonDisabled = useMemo(() => {
    if (!recipientAddress) {
      return false;
    }

    return isBuilding;
  }, [isBuilding, recipientAddress]);

  const selectCollectibleDetails: ListItemProps[] = useMemo(
    () => [
      {
        title: t("common.name"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Text md primary>
              {selectedCollectible?.name}
            </Text>
          </View>
        ),
      },
      {
        title: t("common.collection"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Text md primary>
              {selectedCollectible?.collectionName}
            </Text>
          </View>
        ),
      },
      {
        title: t("common.tokenId"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Text md primary>
              {selectedCollectible?.tokenId}
            </Text>
          </View>
        ),
      },
    ],
    [selectedCollectible, themeColors.text.secondary, t],
  );

  const openSecurityWarningBottomSheet = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.present();
  }, []);

  const bannerContent = useSendBannerContent({
    isMalicious: transactionSecurityAssessment.isMalicious,
    isSuspicious: transactionSecurityAssessment.isSuspicious,
    isUnableToScan: transactionSecurityAssessment.isUnableToScan,
    onSecurityWarningPress: openSecurityWarningBottomSheet,
  });

  const handleConfirmAnyway = useCallback(() => {
    transactionSecurityWarningBottomSheetModalRef.current?.dismiss();

    const isUnableToScan =
      !transactionScanResult || transactionSecurityAssessment.isUnableToScan;

    if (isUnableToScan) {
      reviewBottomSheetModalRef.current?.present();
    } else {
      handleTransactionConfirmation();
    }
  }, [
    handleTransactionConfirmation,
    transactionScanResult,
    transactionSecurityAssessment.isUnableToScan,
  ]);

  if (isProcessing) {
    return (
      <TransactionProcessingScreen
        type={SendType.Collectible}
        key={selectedCollectible?.collectionAddress}
        onClose={handleProcessingScreenClose}
        selectedCollectible={selectedCollectible}
      />
    );
  }

  const handleContinueButtonPress = () => {
    if (!recipientAddress) {
      navigateToSelectContactScreen();
      return;
    }

    // Only open security detail sheet first for "unable to scan" cases
    if (transactionSecurityAssessment.isUnableToScan) {
      prepareTransaction(false);
      transactionSecurityWarningBottomSheetModalRef.current?.present();
    } else {
      prepareTransaction(true);
    }
  };

  const getContinueButtonText = () => {
    if (!recipientAddress) {
      return t("transactionAmountScreen.chooseRecipient");
    }

    return t("transactionAmountScreen.reviewButton");
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="rounded-[16px] py-[12px] px-[16px] bg-background-tertiary max-xs:mt-[4px]">
          <ContactRow
            isSingleRow
            onPress={navigateToSelectContactScreen}
            address={recipientAddress}
            rightElement={
              <IconButton Icon={Icon.ChevronRight} size="sm" variant="ghost" />
            }
          />
        </View>
        <View className="mt-[24px] w-full flex items-center justify-center">
          <View className="w-[240px] h-[240px] rounded-2xl bg-background-tertiary p-1">
            <CollectibleImage
              imageUri={selectedCollectible?.image}
              placeholderIconSize={65}
            />
          </View>
        </View>
        <View className="mt-[24px]">
          <List variant="secondary" items={selectCollectibleDetails} />
        </View>
        <View className="w-full mt-auto mb-4">
          <Button
            tertiary
            xl
            onPress={handleContinueButtonPress}
            disabled={isContinueButtonDisabled}
          >
            {getContinueButtonText()}
          </Button>
        </View>
      </View>
      <BottomSheet
        modalRef={reviewBottomSheetModalRef}
        handleCloseModal={() => reviewBottomSheetModalRef.current?.dismiss()}
        analyticsEvent={AnalyticsEvent.VIEW_SEND_CONFIRM}
        scrollable
        customContent={
          <SendReviewBottomSheet
            type={SendType.Collectible}
            selectedCollectible={selectedCollectible}
            onBannerPress={bannerContent?.onPress}
            // is passed here so the entire layout is ready when modal mounts, otherwise leaves a gap at the bottom related to the warning size
            isRequiredMemoMissing={false}
            isMalicious={transactionSecurityAssessment.isMalicious}
            isSuspicious={transactionSecurityAssessment.isSuspicious}
            isUnableToScan={transactionSecurityAssessment.isUnableToScan}
            bannerText={bannerContent?.text}
            bannerVariant={bannerContent?.variant}
            signTransactionDetails={signTransactionDetails}
          />
        }
        renderFooterComponent={renderFooterComponent}
      />
      <BottomSheet
        modalRef={addMemoExplanationBottomSheetModalRef}
        handleCloseModal={onCancelAddMemo}
        customContent={
          <InformationBottomSheet
            title={t("addMemoExplanationBottomSheet.title")}
            onClose={onCancelAddMemo}
            onConfirm={onConfirmAddMemo}
            headerElement={
              <View className="bg-red-3 p-2 rounded-[8px]">
                <Icon.InfoOctagon
                  color={themeColors.status.error}
                  size={28}
                  withBackground
                />
              </View>
            }
            texts={[
              {
                key: "description",
                value: t("addMemoExplanationBottomSheet.description"),
              },
              {
                key: "disabledWarning",
                value: t("addMemoExplanationBottomSheet.disabledWarning"),
              },
              {
                key: "checkMemoRequirements",
                value: t("addMemoExplanationBottomSheet.checkMemoRequirements"),
              },
            ]}
          />
        }
      />
      <BottomSheet
        modalRef={transactionSettingsBottomSheetModalRef}
        handleCloseModal={() =>
          transactionSettingsBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <TransactionSettingsBottomSheet
            context={TransactionContext.Send}
            onCancel={handleCancelTransactionSettings}
            onConfirm={handleConfirmTransactionSettings}
            onSettingsChange={handleSettingsChange}
          />
        }
      />
      <BottomSheet
        modalRef={transactionSecurityWarningBottomSheetModalRef}
        handleCloseModal={handleCancelSecurityWarning}
        customContent={
          <SecurityDetailBottomSheet
            warnings={transactionSecurityWarnings}
            onCancel={handleCancelSecurityWarning}
            onProceedAnyway={handleConfirmAnyway}
            onClose={handleCancelSecurityWarning}
            severity={transactionSecuritySeverity}
            proceedAnywayText={
              transactionSecurityAssessment.isUnableToScan
                ? t("common.continue")
                : t("transactionAmountScreen.confirmAnyway")
            }
          />
        }
      />
    </BaseLayout>
  );
};

export default SendCollectibleReviewScreen;
