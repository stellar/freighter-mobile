import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import {
  formatConversionRate,
  getTokenFromBalance,
  calculateTokenFiatAmount,
} from "components/screens/SwapScreen/helpers";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING } from "config/constants";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useDebugStore } from "ducks/debug";
import { useSwapStore } from "ducks/swap";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { calculateSwapRate } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import { formatTokenForDisplay, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  assessTokenSecurity,
  assessTransactionSecurity,
} from "services/blockaid/helper";

type SwapReviewBottomSheetProps = {
  onSecurityWarningPress?: () => void;
  transactionScanResult: Blockaid.StellarTransactionScanResponse | undefined;
  sourceTokenScanResult: Blockaid.TokenBulkScanResponse.Results | undefined;
  destTokenScanResult: Blockaid.TokenBulkScanResponse.Results | undefined;
};

const SwapReviewBottomSheet: React.FC<SwapReviewBottomSheetProps> = ({
  onSecurityWarningPress,
  transactionScanResult,
  sourceTokenScanResult,
  destTokenScanResult,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { overriddenBlockaidResponse } = useDebugStore();

  const {
    sourceAmount,
    destinationAmount,
    pathResult,
    sourceTokenSymbol,
    destinationTokenSymbol,
  } = useSwapStore();
  const { transactionXDR } = useTransactionBuilderStore();
  const transactionDetails = useSignTransactionDetails({
    xdr: transactionXDR || "",
  });
  const swapTransactionDetailsBottomSheetModalRef =
    useRef<BottomSheetModal>(null);

  const handleOpenTransactionDetails = () => {
    swapTransactionDetailsBottomSheetModalRef.current?.present();
  };

  const handleDismiss = () => {
    swapTransactionDetailsBottomSheetModalRef.current?.dismiss();
  };

  const [stableConversionRate, setStableConversionRate] = useState<string>("");

  const currentConversionRate =
    pathResult?.conversionRate ||
    calculateSwapRate(
      Number(pathResult?.sourceAmount),
      Number(pathResult?.destinationAmount),
    );

  useEffect(() => {
    if (
      currentConversionRate &&
      !Number.isNaN(Number(currentConversionRate)) &&
      Number(currentConversionRate) > 0
    ) {
      const formattedRate = formatConversionRate({
        rate: currentConversionRate,
        sourceSymbol: sourceTokenSymbol,
        destinationSymbol: destinationTokenSymbol,
      });

      setStableConversionRate(formattedRate);
    }
  }, [currentConversionRate, sourceTokenSymbol, destinationTokenSymbol]);

  const { sourceTokenId, destinationTokenId } = useSwapStore();
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const sourceBalance = useMemo(
    () => balanceItems.find((item) => item.id === sourceTokenId),
    [balanceItems, sourceTokenId],
  );

  const destinationBalance = useMemo(
    () => balanceItems.find((item) => item.id === destinationTokenId),
    [balanceItems, destinationTokenId],
  );

  const sourceToken = getTokenFromBalance(sourceBalance);
  const destinationToken = getTokenFromBalance(destinationBalance);

  const sourceTokenFiatAmountValue = calculateTokenFiatAmount({
    token: sourceToken,
    amount: pathResult?.sourceAmount || sourceAmount,
    balanceItems,
  });

  const sourceTokenFiatAmount =
    sourceTokenFiatAmountValue !== "--"
      ? formatFiatAmount(sourceTokenFiatAmountValue)
      : "--";

  const destinationTokenFiatAmountValue = calculateTokenFiatAmount({
    token: destinationToken,
    amount: pathResult?.destinationAmount || destinationAmount,
    balanceItems,
  });
  const destinationTokenFiatAmount =
    destinationTokenFiatAmountValue !== "--"
      ? formatFiatAmount(destinationTokenFiatAmountValue)
      : "--";

  const publicKey = account?.publicKey;

  const transactionSecurityAssessment = assessTransactionSecurity(
    transactionScanResult,
    overriddenBlockaidResponse,
  );
  const sourceSecurityAssessment = assessTokenSecurity(
    sourceTokenScanResult,
    overriddenBlockaidResponse,
  );
  const destSecurityAssessment = assessTokenSecurity(
    destTokenScanResult,
    overriddenBlockaidResponse,
  );

  const { isMalicious: isTxMalicious, isSuspicious: isTxSuspicious } =
    transactionSecurityAssessment;
  const { isMalicious: isSourceMalicious, isSuspicious: isSourceSuspicious } =
    sourceSecurityAssessment;
  const { isMalicious: isDestMalicious, isSuspicious: isDestSuspicious } =
    destSecurityAssessment;

  const isMalicious = isTxMalicious || isSourceMalicious || isDestMalicious;
  const isSuspicious = isTxSuspicious || isSourceSuspicious || isDestSuspicious;
  const isUnableToScanToken =
    (sourceSecurityAssessment.isUnableToScan && sourceTokenId !== "XLM") ||
    destSecurityAssessment.isUnableToScan;

  const bannerText = useMemo(() => {
    if (isTxMalicious) {
      return t("transactionAmountScreen.errors.malicious");
    }

    if (isTxSuspicious) {
      return t("transactionAmountScreen.errors.suspicious");
    }

    if (isDestMalicious || isSourceMalicious) {
      return t("transactionAmountScreen.errors.maliciousAsset");
    }

    if (isDestSuspicious || isSourceSuspicious) {
      return t("transactionAmountScreen.errors.suspiciousAsset");
    }

    if (isUnableToScanToken) {
      return t("securityWarning.proceedWithCaution");
    }

    return t("transactionAmountScreen.errors.malicious");
  }, [
    t,
    isTxMalicious,
    isTxSuspicious,
    isDestMalicious,
    isSourceMalicious,
    isDestSuspicious,
    isSourceSuspicious,
    isUnableToScanToken,
  ]);

  return (
    <View className="flex-1">
      <View className="rounded-[16px] p-[16px] gap-[16px] bg-background-tertiary">
        <Text lg medium>
          {t("swapScreen.review.title")}
        </Text>

        <View className="gap-[16px]">
          <View className="w-full flex-row items-center gap-4">
            <View className="relative">
              <TokenIcon token={sourceToken} />
              {(isSourceMalicious || isSourceSuspicious) && (
                <View className="absolute bottom-0 right-0 w-4 h-4 items-center justify-center z-10">
                  <Icon.AlertCircle
                    size={8}
                    testID="alert-icon"
                    themeColor={isSourceMalicious ? "red" : "amber"}
                    withBackground
                  />
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text xl medium>
                {formatTokenForDisplay(sourceAmount, sourceTokenSymbol)}
              </Text>
              <Text md medium secondary>
                {sourceTokenFiatAmount}
              </Text>
            </View>
          </View>

          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>

          <View className="w-full flex-row items-center gap-4">
            <View className="relative">
              <TokenIcon token={destinationToken} />
              {(isDestMalicious || isDestSuspicious) && (
                <View className="absolute bottom-0 right-0 w-4 h-4 items-center justify-center z-10">
                  <Icon.AlertCircle
                    size={8}
                    testID="alert-icon"
                    themeColor={isDestMalicious ? "red" : "amber"}
                    withBackground
                  />
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text xl medium>
                {formatTokenForDisplay(
                  destinationAmount,
                  destinationTokenSymbol,
                )}
              </Text>
              <Text md medium secondary>
                {destinationTokenFiatAmount}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {(isMalicious || isSuspicious || isUnableToScanToken) && (
        <Banner
          className="mt-[16px]"
          variant={isSuspicious || isUnableToScanToken ? "warning" : "error"}
          text={bannerText}
          onPress={onSecurityWarningPress}
        />
      )}

      <List
        variant="secondary"
        className="mt-[16px]"
        items={[
          {
            icon: <Icon.Wallet01 size={16} themeColor="gray" />,
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.wallet")}
              </Text>
            ),
            trailingContent: (
              <View className="flex-row items-center gap-[8px]">
                <Text md medium>
                  {account?.accountName ||
                    truncateAddress(publicKey ?? "", 4, 4)}
                </Text>
                <Avatar
                  size="sm"
                  publicAddress={publicKey ?? ""}
                  hasDarkBackground
                />
              </View>
            ),
          },
          {
            icon: (
              <Icon.SwitchHorizontal01
                size={16}
                color={themeColors.foreground.primary}
              />
            ),
            titleComponent: (
              <Text md secondary color={THEME.colors.text.secondary}>
                {t("swapScreen.review.rate")}
              </Text>
            ),
            trailingContent: (
              <Text md medium>
                {stableConversionRate || "--"}
              </Text>
            ),
          },
        ]}
      />

      <TouchableOpacity
        className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px] mt-[16px]"
        onPress={handleOpenTransactionDetails}
      >
        <Icon.List size={16} themeColor="lilac" />
        <Text color={themeColors.lilac[11]}>
          {t("dappRequestBottomSheetContent.transactionDetails")}
        </Text>
      </TouchableOpacity>
      {transactionDetails && (
        <BottomSheet
          modalRef={swapTransactionDetailsBottomSheetModalRef}
          handleCloseModal={() =>
            swapTransactionDetailsBottomSheetModalRef.current?.dismiss()
          }
          enableDynamicSizing={false}
          useInsetsBottomPadding={false}
          enablePanDownToClose={false}
          analyticsEvent={AnalyticsEvent.VIEW_SWAP_TRANSACTION_DETAILS}
          snapPoints={["90%"]}
          customContent={
            <SignTransactionDetailsBottomSheet
              data={transactionDetails}
              onDismiss={handleDismiss}
            />
          }
        />
      )}
    </View>
  );
};

type SwapReviewFooterProps = {
  isMalicious: boolean;
  isSuspicious: boolean;
  isUnableToScanToken?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  isBuilding?: boolean;
  onSettingsPress?: () => void;
  transactionXDR?: string;
};

export const SwapReviewFooter: React.FC<SwapReviewFooterProps> = React.memo(
  (props) => {
    const { t } = useAppTranslation();
    const insets = useSafeAreaInsets();

    const {
      isMalicious,
      isSuspicious,
      isUnableToScanToken = false,
      onCancel,
      onConfirm,
      isBuilding = false,
      transactionXDR,
      onSettingsPress,
    } = props;

    const isTrusted = !isMalicious && !isSuspicious;
    const isDisabled = !transactionXDR || isBuilding;

    const renderButtons = () => {
      const confirmButton = (
        <View className="flex-1">
          <Button
            biometric={!isDisabled}
            onPress={onConfirm}
            tertiary
            xl
            disabled={isDisabled}
          >
            {t("common.confirm")}
          </Button>
        </View>
      );
      const settingsButton = (
        <TouchableOpacity
          onPress={onSettingsPress}
          className="border border-gray-6 items-center justify-center"
          style={{
            height: pxValue(50),
            borderRadius: pxValue(25),
            width: pxValue(50),
          }}
        >
          <Icon.Settings04 size={24} themeColor="gray" />
        </TouchableOpacity>
      );

      const cancelButton = (
        <View className={`${isTrusted ? "flex-1" : "w-full"}`}>
          <Button
            tertiary={isSuspicious}
            secondary={isUnableToScanToken || isTrusted}
            destructive={isMalicious}
            xl
            isFullWidth
            onPress={onCancel}
          >
            {t("common.cancel")}
          </Button>
        </View>
      );

      const confirmAnywayButton = isUnableToScanToken ? (
        <View className="flex-1">
          <Button xl isFullWidth onPress={onConfirm} variant="tertiary">
            {t("transactionAmountScreen.confirmAnyway")}
          </Button>
        </View>
      ) : (
        <TextButton
          text={t("transactionAmountScreen.confirmAnyway")}
          onPress={onConfirm}
          variant={isMalicious ? "error" : "secondary"}
        />
      );

      if (!isTrusted) {
        return (
          <View
            className={`${isUnableToScanToken ? "flex-row gap-3" : "gap-3"}`}
          >
            {cancelButton}
            {confirmAnywayButton}
          </View>
        );
      }

      return (
        <>
          {onSettingsPress && settingsButton}
          {cancelButton}
          {confirmButton}
        </>
      );
    };

    return (
      <View
        className={`${isTrusted ? "flex-row" : "flex-col"} bg-background-primary w-full gap-[12px] mt-[24px] px-6 py-6`}
        style={{
          paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING),
          gap: pxValue(12),
        }}
      >
        {renderButtons()}
      </View>
    );
  },
);

export default SwapReviewBottomSheet;
