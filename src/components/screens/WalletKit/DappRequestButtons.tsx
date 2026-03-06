import { Button } from "components/sds/Button";
import { TextButton } from "components/sds/TextButton";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DappRequestButtonsProps {
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  isSigning: boolean;
  isValidatingMemo?: boolean;
  isMemoMissing?: boolean;
  onCancelRequest: () => void;
  onConfirm: () => void;
  proceedAnywayAction?: () => void;
}

export const DappRequestButtons: React.FC<DappRequestButtonsProps> = ({
  isMalicious,
  isSuspicious,
  isUnableToScan,
  isSigning,
  isValidatingMemo,
  isMemoMissing,
  onCancelRequest,
  onConfirm,
  proceedAnywayAction,
}) => {
  const { t } = useAppTranslation();

  if (!isMalicious && !isSuspicious && !isUnableToScan) {
    return (
      <View className="flex-row justify-between gap-3">
        <View className="flex-1">
          <Button
            secondary
            xl
            isFullWidth
            onPress={onCancelRequest}
            disabled={isSigning || !!isValidatingMemo}
            testID="dapp-request-cancel-button"
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            biometric
            tertiary
            xl
            isFullWidth
            onPress={() => onConfirm()}
            isLoading={isSigning || !!isValidatingMemo}
            disabled={!!isMemoMissing || isSigning || !!isValidatingMemo}
            testID="dapp-request-confirm-button"
          >
            {t("dappRequestBottomSheetContent.confirm")}
          </Button>
        </View>
      </View>
    );
  }

  if (isUnableToScan) {
    return (
      <View className="flex-row justify-between gap-3">
        <View className="flex-1">
          <Button
            secondary
            xl
            isFullWidth
            onPress={onCancelRequest}
            disabled={isSigning || !!isValidatingMemo}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            biometric
            tertiary
            xl
            isFullWidth
            onPress={() => proceedAnywayAction?.()}
            isLoading={isSigning || !!isValidatingMemo}
            disabled={!!isMemoMissing || isSigning || !!isValidatingMemo}
          >
            {t("common.continue")}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-col gap-3">
      <View className="w-full">
        <Button
          tertiary={isSuspicious}
          destructive={isMalicious}
          xl
          isFullWidth
          onPress={onCancelRequest}
          disabled={isSigning}
        >
          {t("common.cancel")}
        </Button>
      </View>
      <View className="w-full">
        <TextButton
          text={t("dappRequestBottomSheetContent.confirmAnyway")}
          biometric
          onPress={() => onConfirm()}
          isLoading={isSigning}
          disabled={isSigning}
          variant={isMalicious ? "error" : "secondary"}
        />
      </View>
    </View>
  );
};
