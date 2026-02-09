import BigNumber from "bignumber.js";
import { CollectibleImage } from "components/CollectibleImage";
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
import { DEFAULT_PADDING, NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance } from "config/types";
import { Collectible as CollectibleType } from "ducks/collectibles";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isLiquidityPool } from "helpers/balances";
import { pxValue } from "helpers/dimensions";
import { formatTokenForDisplay, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress, isMuxedAccount } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export enum SendType {
  Token = "token",
  Collectible = "collectible",
}

type SendReviewBottomSheetProps = {
  type: SendType;
  selectedBalance?: PricedBalance;
  tokenAmount?: string;
  selectedCollectible?: CollectibleType;
  /**
   * Indicates if a required memo is missing from the transaction
   * When true, shows a warning banner and may disable transaction confirmation
   */
  isRequiredMemoMissing?: boolean;
  /**
   * Callback function when the memo warning banner is pressed
   * Typically opens a modal to explain why the memo is required
   */
  onBannerPress?: () => void;
  /**
   * Text to display in the banner
   */
  bannerText?: string;
  /**
   * Variant of the banner (error or warning)
   */
  bannerVariant?: "error" | "warning";
  signTransactionDetails?: SignTransactionDetailsInterface | null;
  amountError?: string | null;
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
  type,
  selectedBalance,
  tokenAmount,
  selectedCollectible,
  isRequiredMemoMissing,
  onBannerPress,
  bannerText,
  bannerVariant,
  signTransactionDetails,
  amountError: propAmountError,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recipientAddress, transactionMemo, transactionFee } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const { copyToClipboard } = useClipboard();
  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const { transactionXDR, isBuilding, error } = useTransactionBuilderStore();

  // Use amountError from props (calculated in parent component)
  const amountError = propAmountError;

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
          <Icon.AlertTriangle size={16} themeColor="red" />
        )}
      </View>
    );
  }, [isBuilding, isRequiredMemoMissing, t, themeColors.text.secondary]);

  const renderBanner = () => {
    // Show amount error banner if present, otherwise show other banners
    const displayBannerText = amountError || bannerText;
    const displayBannerVariant = amountError
      ? "error"
      : bannerVariant || "error";

    if (!displayBannerText) {
      return null;
    }

    return (
      <Banner
        variant={displayBannerVariant}
        text={displayBannerText}
        onPress={amountError ? undefined : onBannerPress}
      />
    );
  };

  /**
   * Renders the confirm button with different states based on memo validation
   * When a required memo is missing, shows "Add Memo" button
   * When memo validation is in progress, shows "Add Memo" button (disabled)
   * Otherwise shows the standard "Confirm" button for transaction submission
   *
   * @returns {JSX.Element} The appropriate button for the current state
   */

  const isRecipientMuxed = isMuxedAccount(recipientAddress);

  const transactionDetailsList: ListItemProps[] = useMemo(
    () =>
      [
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
        // Hide memo line for M addresses (memo is encoded in the address)
        !isRecipientMuxed
          ? {
              icon: (
                <Icon.File02 size={16} color={themeColors.foreground.primary} />
              ),
              titleComponent: renderMemoTitle(),
              trailingContent: (
                <Text md secondary={!transactionMemo}>
                  {transactionMemo || t("common.none")}
                </Text>
              ),
            }
          : undefined,
        {
          icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
          title: t("transactionAmountScreen.details.fee"),
          titleColor: themeColors.text.secondary,
          trailingContent: (
            <Text md primary>
              {formatTokenForDisplay(transactionFee, NATIVE_TOKEN_CODE)}
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
      ].filter(Boolean) as ListItemProps[],
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
      isRecipientMuxed,
    ],
  );

  return (
    <View className="flex-1 gap-[12px]" testID="send-review-sheet">
      <View className="rounded-[16px] p-[16px] gap-[16px] bg-background-tertiary">
        <Text lg>{t("transactionReviewScreen.title")}</Text>
        <View className="gap-[16px]">
          {type === SendType.Token &&
            selectedBalance &&
            tokenAmount &&
            !isLiquidityPool(selectedBalance) && (
              <View className="w-full flex-row items-center gap-[16px]">
                <TokenIcon token={selectedBalance} />
                <View className="flex-1">
                  <Text xl medium>
                    {formatTokenForDisplay(
                      tokenAmount,
                      selectedBalance.tokenCode,
                    )}
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
          {type === SendType.Collectible && selectedCollectible && (
            <View className="w-full flex-row items-center gap-[16px]">
              <View className="w-[40px] h-[40px] rounded-[8px] bg-background-tertiary overflow-hidden">
                <CollectibleImage
                  imageUri={selectedCollectible?.image}
                  placeholderIconSize={25}
                />
              </View>
              <View className="flex-1">
                <Text xl medium>
                  {selectedCollectible.name}
                </Text>
                <Text md medium secondary>
                  {`${selectedCollectible.collectionName} #${selectedCollectible.tokenId}`}
                </Text>
              </View>
            </View>
          )}
          <View className="w-[40px] flex items-center py-1">
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
    </View>
  );
};

type SendReviewFooterProps = {
  onCancel?: () => void;
  onConfirm?: () => void;
  isRequiredMemoMissing?: boolean;
  isMalicious?: boolean;
  isValidatingMemo?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  isExpectedToFail?: boolean;
  isMuxedAddressWithoutMemoSupport?: boolean;
  onSettingsPress?: () => void;
  amountError?: string | null;
};

export const SendReviewFooter: React.FC<SendReviewFooterProps> = React.memo(
  (props) => {
    const { t } = useAppTranslation();
    const { transactionXDR, isBuilding, error } = useTransactionBuilderStore();
    const insets = useSafeAreaInsets();

    const {
      onCancel,
      onConfirm,
      isRequiredMemoMissing,
      isMalicious,
      isValidatingMemo,
      isSuspicious,
      isUnableToScan,
      isExpectedToFail,
      isMuxedAddressWithoutMemoSupport,
      onSettingsPress,
      amountError,
    } = props;

    const isTrusted =
      !isMalicious &&
      !isSuspicious &&
      !isUnableToScan &&
      !isExpectedToFail &&
      !isMuxedAddressWithoutMemoSupport;
    const isLoading = isBuilding;
    const isDisabled = !transactionXDR || isLoading;

    const shouldUseRowLayout = isTrusted || isMuxedAddressWithoutMemoSupport;

    const renderConfirmButton = useCallback(() => {
      const getButtonText = () => {
        if (isLoading || isValidatingMemo) {
          return t("common.confirm");
        }

        if (isRequiredMemoMissing) {
          return isTrusted ? t("common.addMemoShorthand") : t("common.addMemo");
        }

        return t("common.confirm");
      };

      const isConfirmDisabled =
        isBuilding ||
        !transactionXDR ||
        !!error ||
        isValidatingMemo ||
        isMuxedAddressWithoutMemoSupport ||
        !!amountError;

      return (
        <View className="flex-1">
          <Button
            biometric={!isRequiredMemoMissing && !isConfirmDisabled}
            onPress={() => onConfirm?.()}
            isLoading={isLoading || isValidatingMemo}
            tertiary
            xl
            disabled={isConfirmDisabled}
            testID="send-review-confirm-button"
          >
            {getButtonText()}
          </Button>
        </View>
      );
    }, [
      isRequiredMemoMissing,
      isValidatingMemo,
      onConfirm,
      isTrusted,
      isLoading,
      t,
      isBuilding,
      transactionXDR,
      error,
      isMuxedAddressWithoutMemoSupport,
      amountError,
    ]);

    const renderButtons = useCallback(() => {
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
        <View className={`${shouldUseRowLayout ? "flex-1" : "w-full"}`}>
          <Button
            tertiary={(isSuspicious && !isUnableToScan) || isExpectedToFail}
            destructive={isMalicious && !shouldUseRowLayout}
            secondary={shouldUseRowLayout}
            isFullWidth
            onPress={onCancel}
            disabled={isDisabled}
            testID="send-review-cancel-button"
          >
            {t("common.cancel")}
          </Button>
        </View>
      );

      const confirmAnywayButton = (
        <TextButton
          text={
            isRequiredMemoMissing
              ? t("common.addMemo")
              : t("transactionAmountScreen.confirmAnyway")
          }
          onPress={onConfirm}
          isLoading={isLoading}
          disabled={isDisabled}
          variant={isMalicious ? "error" : "secondary"}
          testID="send-review-confirm-anyway-button"
        />
      );

      if (!shouldUseRowLayout) {
        return (
          <>
            {cancelButton}
            {confirmAnywayButton}
          </>
        );
      }

      return (
        <>
          {onSettingsPress && settingsButton}
          {cancelButton}
          {renderConfirmButton()}
        </>
      );
    }, [
      onSettingsPress,
      shouldUseRowLayout,
      isSuspicious,
      isMalicious,
      isUnableToScan,
      isExpectedToFail,
      onCancel,
      isRequiredMemoMissing,
      isDisabled,
      t,
      onConfirm,
      isLoading,
      renderConfirmButton,
    ]);

    return (
      <View
        className={`${
          shouldUseRowLayout ? "flex-row" : "flex-col"
        } bg-background-primary w-full gap-[12px] mt-[24px] flex-column px-6 py-6`}
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

export default SendReviewBottomSheet;
