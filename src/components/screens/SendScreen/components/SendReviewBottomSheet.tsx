import { BigNumber } from "bignumber.js";
import { List, ListItemProps } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import SignTransactionDetails from "components/screens/SignTransactionDetails";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance } from "config/types";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isLiquidityPool } from "helpers/balances";
import { formatTokenAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

type SendReviewBottomSheetProps = {
  selectedBalance?: PricedBalance;
  tokenAmount: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  /**
   * Indicates if a required memo is missing from the transaction
   * When true, shows a warning banner and may disable transaction confirmation
   */
  isRequiredMemoMissing?: boolean;
  /**
   * Indicates if memo validation is currently in progress
   * Used to show loading states and prevent premature actions
   */
  isValidatingMemo?: boolean;
  /**
   * Callback function when the memo warning banner is pressed
   * Typically opens a modal to explain why the memo is required
   */
  onBannerPress?: () => void;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  signTransactionDetails?: SignTransactionDetailsInterface | null;
};

/**
 * SendReviewBottomSheet Component
 *
 * A bottom sheet modal that displays transaction review information before sending.
 * Shows transaction details including amount, recipient, fee, timeout, and memo.
 *
 * Features:
 * - Displays transaction summary with all relevant details
 * - Shows memo validation warnings when required memos are missing
 * - Provides copy functionality for transaction XDR
 * - Handles loading states during transaction building
 * - Integrates with memo validation flow
 *
 * @param {SendReviewBottomSheetProps} props - Component props
 * @returns {JSX.Element} The rendered bottom sheet component
 */
const SendReviewBottomSheet: React.FC<SendReviewBottomSheetProps> = ({
  selectedBalance,
  tokenAmount,
  onCancel,
  onConfirm,
  isRequiredMemoMissing,
  isValidatingMemo,
  onBannerPress,
  isMalicious,
  isSuspicious,
  signTransactionDetails,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recipientAddress, transactionMemo, transactionFee } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();
  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const { transactionXDR, isBuilding, error } = useTransactionBuilderStore();

  const handleCopyXdr = useCallback(() => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  }, [copyToClipboard, t, transactionXDR]);

  const renderXdrContent = useCallback(() => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    if (error) {
      return (
        <Text md medium color={themeColors.status.error}>
          {t("common.error", { errorMessage: error })}
        </Text>
      );
    }

    if (transactionXDR) {
      return truncateAddress(transactionXDR, 10, 4);
    }

    return t("common.none");
  }, [
    error,
    isBuilding,
    t,
    themeColors.status.error,
    themeColors.text.secondary,
    transactionXDR,
  ]);

  /**
   * Renders the memo section title with appropriate icon and warning indicator
   * Shows a loading spinner during transaction building
   * Displays a warning triangle icon when a required memo is missing
   *
   * @returns {JSX.Element} The memo title with icon and optional warning
   */
  const renderMemoTitle = useCallback(() => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    return (
      <View className="flex-row items-center gap-[8px]">
        <Text md medium secondary>
          {t("transactionAmountScreen.details.memo")}
        </Text>
        {isRequiredMemoMissing && (
          <Icon.AlertTriangle size={16} color={themeColors.status.error} />
        )}
      </View>
    );
  }, [
    isBuilding,
    isRequiredMemoMissing,
    t,
    themeColors.status.error,
    themeColors.text.secondary,
  ]);

  /**
   * Renders a warning banner for the following cases:
   * - When a required memo is missing
   * - When the transaction is flagged as malicious
   * - When the transaction is flagged as suspicious
   * Includes a call-to-action button to add the required memo
   *
   * @returns {JSX.Element | null} Warning banner or null if no warning needed
   */
  const renderBanner = () => {
    if (!isRequiredMemoMissing && !isMalicious && !isSuspicious) {
      return null;
    }

    const getBannerText = () => {
      if (isMalicious) {
        return t("transactionAmountScreen.errors.malicious");
      }

      if (isSuspicious) {
        return t("transactionAmountScreen.errors.suspicious");
      }

      return t("transactionAmountScreen.errors.memoMissing");
    };

    return (
      <Banner
        variant={isSuspicious ? "warning" : "error"}
        text={getBannerText()}
        onPress={onBannerPress}
      />
    );
  };

  const isLoading = isValidatingMemo || isBuilding;
  const isDisabled = !transactionXDR || isLoading;

  /**
   * Renders the confirm button with different states based on memo validation
   * When a required memo is missing, shows "Add Memo" button
   * When memo validation is in progress, shows "Add Memo" button (disabled)
   * Otherwise shows the standard "Confirm" button for transaction submission
   *
   * @returns {JSX.Element} The appropriate button for the current state
   */
  const renderConfirmButton = () => {
    const getButtonText = () => {
      if (isRequiredMemoMissing || isValidatingMemo) {
        return t("common.addMemo");
      }

      return t("common.confirm");
    };

    return (
      <View className="flex-1">
        <Button
          biometric
          onPress={() => onConfirm?.()}
          tertiary
          xl
          disabled={isBuilding || !transactionXDR || !!error}
        >
          {getButtonText()}
        </Button>
      </View>
    );
  };

  const renderButtons = () => {
    const cancelButton = (
      <View
        className={`${!isMalicious && !isSuspicious ? "flex-1" : "w-full"}`}
      >
        <Button
          tertiary={isSuspicious}
          destructive={isMalicious}
          secondary={!isMalicious && !isSuspicious}
          xl
          isFullWidth
          onPress={onCancel}
          disabled={isDisabled}
        >
          {t("common.cancel")}
        </Button>
      </View>
    );

    if (isMalicious || isSuspicious) {
      return (
        <>
          {cancelButton}
          <TextButton
            text={t("transactionAmountScreen.confirmAnyway")}
            onPress={onConfirm}
            isLoading={isLoading}
            disabled={isDisabled}
            variant={isMalicious ? "error" : "secondary"}
          />
        </>
      );
    }

    return (
      <>
        {cancelButton}
        {renderConfirmButton()}
      </>
    );
  };

  const transactionDetailsList: ListItemProps[] = useMemo(
    () => [
      {
        icon: (
          <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
        ),
        title: t("common.wallet"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Avatar
              size="sm"
              publicAddress={account?.publicKey ?? ""}
              hasDarkBackground
            />
            <Text md primary>
              {account?.accountName}
            </Text>
          </View>
        ),
      },
      {
        icon: <Icon.File02 size={16} color={themeColors.foreground.primary} />,
        titleComponent: renderMemoTitle(),
        trailingContent: (
          <Text md secondary={!transactionMemo}>
            {transactionMemo || t("common.none")}
          </Text>
        ),
      },
      {
        icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
        title: t("transactionAmountScreen.details.fee"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <Text md primary>
            {formatTokenAmount(transactionFee, NATIVE_TOKEN_CODE)}
          </Text>
        ),
      },
      {
        icon: (
          <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
        ),
        title: t("transactionAmountScreen.details.xdr"),
        titleColor: themeColors.text.secondary,
        trailingContent: (
          <TouchableOpacity
            onPress={handleCopyXdr}
            disabled={isBuilding || !transactionXDR}
            className="flex-row items-center gap-[8px]"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary={isBuilding}>
              {renderXdrContent()}
            </Text>
          </TouchableOpacity>
        ),
      },
    ],
    [
      account?.accountName,
      account?.publicKey,
      handleCopyXdr,
      isBuilding,
      renderMemoTitle,
      renderXdrContent,
      t,
      themeColors.foreground.primary,
      themeColors.text.secondary,
      transactionFee,
      transactionMemo,
      transactionXDR,
    ],
  );

  return (
    <View className="flex-1 gap-[12px]">
      <View className="rounded-[16px] p-[16px] gap-[16px] bg-background-tertiary">
        <Text lg>{t("transactionReviewScreen.title")}</Text>
        <View className="gap-[16px]">
          {selectedBalance && !isLiquidityPool(selectedBalance) && (
            <View className="w-full flex-row items-center gap-[16px]">
              <TokenIcon token={selectedBalance} />
              <View className="flex-1">
                <Text xl medium>
                  {formatTokenAmount(tokenAmount, selectedBalance.tokenCode)}
                </Text>
                <Text md medium secondary>
                  {selectedBalance.currentPrice
                    ? formatFiatAmount(
                        new BigNumber(tokenAmount).times(
                          selectedBalance.currentPrice,
                        ),
                      )
                    : "--"}
                </Text>
              </View>
            </View>
          )}
          <View className="w-[40px] flex items-center">
            <Icon.ChevronDownDouble
              size={16}
              color={themeColors.foreground.secondary}
            />
          </View>
          <View className="w-full flex-row items-center gap-[16px]">
            <Avatar
              size="lg"
              publicAddress={recipientAddress}
              hasDarkBackground
            />
            <View className="flex-1">
              <Text xl medium>
                {slicedAddress}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {renderBanner()}
      <List variant="secondary" items={transactionDetailsList} />
      {signTransactionDetails && (
        <SignTransactionDetails
          data={signTransactionDetails}
          analyticsEvent={AnalyticsEvent.VIEW_SEND_TRANSACTION_DETAILS}
        />
      )}
      <View
        className={`${!isMalicious && !isSuspicious ? "flex-row" : "flex-col"} w-full gap-[12px] mt-[4px]`}
      >
        {renderButtons()}
      </View>
    </View>
  );
};

export default SendReviewBottomSheet;
