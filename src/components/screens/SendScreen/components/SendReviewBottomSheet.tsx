import { BottomSheetModal } from "@gorhom/bottom-sheet";
import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import AddMemoFlowBottomSheet from "components/screens/SendScreen/components/AddMemoFlowBottomSheet";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { PricedBalance } from "config/types";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isLiquidityPool } from "helpers/balances";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useValidateTransactionMemo } from "hooks/useValidateTransactionMemo";
import React, { useRef } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

type SendReviewBottomSheetProps = {
  selectedBalance?: PricedBalance;
  tokenAmount: string;
  onConfirmAddMemo: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
};

const SendReviewBottomSheet: React.FC<SendReviewBottomSheetProps> = ({
  selectedBalance,
  tokenAmount,
  onCancel,
  onConfirm,
  onConfirmAddMemo,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recipientAddress, transactionMemo, transactionFee } =
    useTransactionSettingsStore();
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey;
  const { copyToClipboard } = useClipboard();
  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const addMemoFlowBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { transactionXDR, isBuilding, error } = useTransactionBuilderStore();
  const { isValidatingMemo, isMemoRequiredMemoMissing } =
    useValidateTransactionMemo();
  const shouldShowMemoMissingWarning =
    isMemoRequiredMemoMissing && !isValidatingMemo;

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const handleOpenAddMemoExplanationBottomSheet = () => {
    addMemoFlowBottomSheetModalRef.current?.present();
  };

  const renderXdrContent = () => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    if (error) {
      return (
        <Text md medium className="text-red-600">
          {t("common.error", { errorMessage: error })}
        </Text>
      );
    }

    if (transactionXDR) {
      return truncateAddress(transactionXDR, 10, 4);
    }

    return t("common.none");
  };

  const renderMemoTitle = () => {
    if (isBuilding) {
      return (
        <ActivityIndicator size="small" color={themeColors.text.secondary} />
      );
    }

    return (
      <View className="flex-row items-center gap-[8px]">
        <Icon.File02 size={16} color={themeColors.foreground.primary} />
        <Text md medium secondary>
          {t("transactionAmountScreen.details.memo")}
        </Text>
        <Icon.AlertTriangle size={16} color={themeColors.status.error} />
      </View>
    );
  };

  const renderMemoMissingWarning = () => {
    if (!shouldShowMemoMissingWarning) {
      return null;
    }

    return (
      <View className="mt-[16px] rounded-[16px] py-[12px] px-[24px] gap-[12px] bg-red-3">
        <View className="flex-row items-center gap-[8px] justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.AlertSquare size={16} color={themeColors.status.error} />
            <Text md color={themeColors.red[11]}>
              {t("transactionAmountScreen.memoMissing")}
            </Text>
          </View>
          <View>
            <Icon.ChevronRight size={16} color={themeColors.red[11]} />
          </View>
        </View>
      </View>
    );
  };

  const renderConfirmButton = () => {
    if (isMemoRequiredMemoMissing) {
      return (
        <View className="flex-1">
          <Button
            onPress={handleOpenAddMemoExplanationBottomSheet}
            tertiary
            xl
            disabled={isBuilding || !transactionXDR || isValidatingMemo}
          >
            {t("transactionAmountScreen.addMemo")}
          </Button>
        </View>
      );
    }
    return (
      <View className="flex-1">
        <Button
          onPress={onConfirm}
          tertiary
          xl
          disabled={
            isBuilding ||
            !transactionXDR ||
            !!error ||
            isMemoRequiredMemoMissing ||
            isValidatingMemo
          }
        >
          {t("common.confirm")}
        </Button>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary">
        <Text lg medium>
          {t("transactionReviewScreen.title")}
        </Text>
        <View className="gap-[16px]">
          {selectedBalance && !isLiquidityPool(selectedBalance) && (
            <View className="w-full flex-row items-center gap-4">
              <AssetIcon token={selectedBalance} />
              <View className="flex-1">
                <Text xl medium>
                  {formatAssetAmount(tokenAmount, selectedBalance.tokenCode)}
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
          <View className="w-full flex-row items-center gap-4">
            <Avatar size="lg" publicAddress={recipientAddress} />
            <View className="flex-1">
              <Text xl medium>
                {slicedAddress}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {renderMemoMissingWarning()}
      <View
        className={`rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border ${
          shouldShowMemoMissingWarning ? "mt-[16px]" : "mt-[24px]"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.from")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[8px]">
            <Text md medium>
              {account?.accountName || truncateAddress(publicKey ?? "", 4, 4)}
            </Text>
            <Avatar size="sm" publicAddress={publicKey ?? ""} />
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          {renderMemoTitle()}
          <Text md medium secondary={!transactionMemo}>
            {transactionMemo || t("common.none")}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.fee")}
            </Text>
          </View>
          <View className="flex-row items-center gap-[4px]">
            <StellarLogo width={16} height={16} />
            <Text md medium>
              {formatAssetAmount(transactionFee, NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.xdr")}
            </Text>
          </View>
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
        </View>
      </View>
      <View className="mt-[24px]">
        <Text sm medium secondary textAlign="center">
          {t("transactionReviewScreen.reviewMessage")}
        </Text>
      </View>
      <View className="mt-[24px] gap-[12px] flex-row">
        <View className="flex-1">
          <Button onPress={onCancel} secondary xl>
            {t("common.cancel")}
          </Button>
        </View>
        {renderConfirmButton()}
      </View>
      <AddMemoFlowBottomSheet
        modalRef={addMemoFlowBottomSheetModalRef}
        onAddMemo={onConfirmAddMemo}
      />
    </View>
  );
};

export default SendReviewBottomSheet;
