import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { List } from "components/List";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { useSignTransactionDetails } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { SwapReviewTokenRow } from "components/screens/SwapScreen/components/SwapReviewTokenRow";
import { TrustlineInfoBottomSheet } from "components/screens/SwapScreen/components/TrustlineInfoBottomSheet";
import {
  useReviewSecuritySummary,
  useReviewTokens,
  useStableConversionRate,
} from "components/screens/SwapScreen/hooks";
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
import { useSwapStore } from "ducks/swap";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SecurityAssessment } from "services/blockaid/types";

type SwapReviewBottomSheetProps = {
  onSecurityWarningPress?: () => void;
  transactionSecurityAssessment: SecurityAssessment;
  sourceSecurityAssessment: SecurityAssessment;
  destinationSecurityAssessment: SecurityAssessment;
};

const SwapReviewBottomSheet: React.FC<SwapReviewBottomSheetProps> = ({
  onSecurityWarningPress,
  transactionSecurityAssessment,
  sourceSecurityAssessment,
  destinationSecurityAssessment,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();

  const {
    sourceAmount,
    destinationAmount,
    pathResult,
    sourceTokenSymbol,
    sourceTokenId,
    destinationToken: destinationTokenDescriptor,
  } = useSwapStore();
  const { transactionXDR } = useTransactionBuilderStore();
  const transactionDetails = useSignTransactionDetails({
    xdr: transactionXDR || "",
  });
  const swapTransactionDetailsBottomSheetModalRef =
    useRef<BottomSheetModal>(null);
  const trustlineInfoRef = useRef<BottomSheetModal>(null);

  const handleOpenTransactionDetails = () => {
    swapTransactionDetailsBottomSheetModalRef.current?.present();
  };

  const handleDismiss = () => {
    swapTransactionDetailsBottomSheetModalRef.current?.dismiss();
  };

  const { stableConversionRate } = useStableConversionRate({
    pathResult,
    sourceTokenSymbol,
    destinationTokenSymbol: destinationTokenDescriptor?.tokenCode ?? "",
  });

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });

  const {
    sourceToken,
    destinationToken,
    sourceTokenFiatAmount,
    destinationTokenFiatAmount,
  } = useReviewTokens({
    balanceItems,
    sourceTokenId,
    sourceAmount,
    destinationAmount,
    destinationTokenDescriptor,
    pathResult,
  });

  const publicKey = account?.publicKey;

  const {
    isMalicious,
    isSuspicious,
    isUnableToScan,
    isSourceMalicious,
    isSourceSuspicious,
    isDestMalicious,
    isDestSuspicious,
    bannerText,
  } = useReviewSecuritySummary({
    transactionSecurityAssessment,
    sourceSecurityAssessment,
    destinationSecurityAssessment,
    sourceTokenId,
    destinationTokenDescriptor,
  });

  return (
    <View className="flex-1" testID="swap-review-sheet">
      <View className="rounded-[16px] p-[16px] gap-[16px] bg-background-tertiary">
        <Text lg medium>
          {t("swapScreen.review.title")}
        </Text>

        <View className="gap-[16px]">
          <SwapReviewTokenRow
            token={sourceToken}
            amount={sourceAmount}
            symbol={sourceTokenSymbol}
            fiatString={sourceTokenFiatAmount}
            isMalicious={isSourceMalicious}
            isSuspicious={isSourceSuspicious}
          />

          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>

          <SwapReviewTokenRow
            token={destinationToken}
            amount={destinationAmount}
            symbol={destinationTokenDescriptor?.tokenCode ?? ""}
            fiatString={destinationTokenFiatAmount}
            // Carry the descriptor's iconUrl so non-held destinations render
            // their logo instead of a 2-letter fallback.
            iconUrl={destinationTokenDescriptor?.iconUrl}
            isMalicious={isDestMalicious}
            isSuspicious={isDestSuspicious}
          />
        </View>
      </View>

      {destinationTokenDescriptor?.requiresTrustline && (
        <Banner
          className="mt-[16px]"
          variant="highlight"
          text={t("swapScreen.trustlineBanner", {
            tokenCode: destinationTokenDescriptor.tokenCode,
          })}
          onPress={() => trustlineInfoRef.current?.present()}
        />
      )}

      {(isMalicious || isSuspicious || isUnableToScan) && (
        <Banner
          className="mt-[16px]"
          variant={isSuspicious || isUnableToScan ? "warning" : "error"}
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
                <Avatar
                  size="sm"
                  publicAddress={publicKey ?? ""}
                  hasDarkBackground
                />
                <Text md medium>
                  {account?.accountName ||
                    truncateAddress(publicKey ?? "", 4, 4)}
                </Text>
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
      <BottomSheet
        modalRef={trustlineInfoRef}
        handleCloseModal={() => trustlineInfoRef.current?.dismiss()}
        customContent={
          <TrustlineInfoBottomSheet
            bottomSheetModalRef={trustlineInfoRef}
            tokenCode={destinationTokenDescriptor?.tokenCode}
          />
        }
      />
    </View>
  );
};

type SwapReviewFooterProps = {
  isMalicious: boolean;
  isSuspicious: boolean;
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
            testID="swap-review-confirm-button"
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
            secondary={isTrusted}
            destructive={isMalicious}
            xl
            isFullWidth
            onPress={onCancel}
            testID="swap-review-cancel-button"
          >
            {t("common.cancel")}
          </Button>
        </View>
      );

      const confirmAnywayButton = (
        <TextButton
          text={t("transactionAmountScreen.confirmAnyway")}
          onPress={onConfirm}
          variant={isMalicious ? "error" : "secondary"}
          testID="swap-review-confirm-anyway-button"
        />
      );

      if (!isTrusted) {
        return (
          <View className="gap-3">
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
