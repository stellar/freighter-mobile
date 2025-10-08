import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReviewFooterProps = {
  onCancel?: () => void;
  onConfirm?: () => void;
  onSettingsPress?: () => void;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isRequiredMemoMissing?: boolean;
  isValidatingMemo?: boolean;
  isBuilding?: boolean;
  transactionXDR?: string;
  error?: string | null;
  confirmButtonText?: string;
  showBiometric?: boolean;
};

// Helper function to determine if transaction is trusted
const isTransactionTrusted = (
  isMalicious?: boolean,
  isSuspicious?: boolean,
): boolean => !isMalicious && !isSuspicious;

/**
 * Shared ReviewFooter component that handles button layouts for both normal and malicious/suspicious transactions
 *
 * Features:
 * - Normal transactions: Settings button above, Cancel and Confirm buttons side by side
 * - Malicious/Suspicious transactions: Settings button to the left of Cancel button, vertical layout
 * - Supports memo validation states
 * - Handles loading and error states
 */
export const ReviewFooter: React.FC<ReviewFooterProps> = React.memo(
  ({
    onCancel,
    onConfirm,
    onSettingsPress,
    isMalicious = false,
    isSuspicious = false,
    isRequiredMemoMissing = false,
    isValidatingMemo = false,
    isBuilding = false,
    transactionXDR,
    error,
    confirmButtonText,
    showBiometric = false,
  }) => {
    const { t } = useAppTranslation();
    const insets = useSafeAreaInsets();

    const isTrusted = isTransactionTrusted(isMalicious, isSuspicious);
    const isDisabled = !transactionXDR || isBuilding || !!error;

    const renderCancelButton = useCallback(
      () => (
        <View className="flex-1">
          <Button
            destructive={isMalicious || isSuspicious}
            secondary={isTrusted}
            xl
            isFullWidth
            onPress={onCancel}
            disabled={isDisabled}
          >
            {t("common.cancel")}
          </Button>
        </View>
      ),
      [isTrusted, isSuspicious, isMalicious, onCancel, isDisabled, t],
    );

    const renderConfirmButton = useCallback(() => {
      const getConfirmButtonText = () => {
        if (confirmButtonText) {
          return confirmButtonText;
        }

        if (isRequiredMemoMissing || isValidatingMemo) {
          return t("common.addMemo");
        }

        return t("common.confirm");
      };

      if (!isTrusted) {
        return (
          <TextButton
            text={t("transactionAmountScreen.confirmAnyway")}
            onPress={onConfirm}
            isLoading={isBuilding}
            disabled={isDisabled}
            variant={isMalicious ? "error" : "secondary"}
          />
        );
      }

      return (
        <View className="flex-1">
          <Button
            biometric={showBiometric}
            onPress={() => onConfirm?.()}
            tertiary
            xl
            disabled={isBuilding || !transactionXDR || !!error}
          >
            {getConfirmButtonText()}
          </Button>
        </View>
      );
    }, [
      isTrusted,
      isMalicious,
      onConfirm,
      isBuilding,
      isDisabled,
      t,
      confirmButtonText,
      isRequiredMemoMissing,
      isValidatingMemo,
      showBiometric,
      transactionXDR,
      error,
    ]);

    const renderActionButtons = useCallback(() => {
      if (isTrusted) {
        return (
          <>
            {renderCancelButton()}
            {renderConfirmButton()}
          </>
        );
      }

      return (
        <>
          {renderCancelButton()}
          {renderConfirmButton()}
        </>
      );
    }, [isTrusted, renderCancelButton, renderConfirmButton]);

    const renderSettingsButton = useCallback(() => {
      if (!onSettingsPress) return null;

      return (
        <TouchableOpacity
          onPress={onSettingsPress}
          className={`w-[50px] h-[50px] rounded-full border border-gray-6 items-center justify-center ${
            isTrusted ? "" : "self-start"
          }`}
        >
          <Icon.Settings04 size={24} themeColor="gray" />
        </TouchableOpacity>
      );
    }, [onSettingsPress, isTrusted]);

    return (
      <View
        className={`${
          isTrusted ? "flex-row" : "flex-col"
        } bg-background-primary w-full gap-[12px] mt-[24px] flex-column px-6 py-6`}
        style={{
          paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING),
          gap: pxValue(12),
        }}
      >
        {isTrusted && renderSettingsButton()}
        {isTrusted && renderActionButtons()}
        {!isTrusted && (
          <>
            {renderCancelButton()}
            {renderConfirmButton()}
          </>
        )}
      </View>
    );
  },
);

ReviewFooter.displayName = "ReviewFooter";

export default ReviewFooter;
