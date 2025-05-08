import StellarLogo from "assets/logos/stellar-logo.svg";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isLiquidityPool } from "helpers/balances";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useTransactionBuilder } from "hooks/useTransactionBuilder";
import React, { useLayoutEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type SendReviewBottomSheetProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  address: string;
  account: ActiveAccount | null;
  publicKey: string | undefined;
  onCancel?: () => void;
  onConfirm?: () => void;
};

const SendReviewBottomSheet: React.FC<SendReviewBottomSheetProps> = ({
  selectedBalance,
  tokenValue,
  address,
  account,
  publicKey,
  onCancel,
  onConfirm,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { transactionMemo, transactionFee, transactionTimeout } =
    useTransactionSettingsStore();
  const { network } = useAuthenticationStore();
  const { copyToClipboard } = useClipboard();
  const { buildPaymentTransaction } = useTransactionBuilder();
  const slicedAddress = truncateAddress(address, 4, 4);

  // Use stable state for transaction XDR to prevent unnecessary re-renders
  const [transactionXdr, setTransactionXdr] = useState<string>("");
  const [isLoadingXdr, setIsLoadingXdr] = useState<boolean>(true);
  const [transactionError, setTransactionError] = useState<string>("");

  const xdrGenerationAttempted = useRef(false);

  useLayoutEffect(() => {
    if (xdrGenerationAttempted.current) {
      return undefined;
    }

    let isMounted = true;
    const generateXdr = async () => {
      if (!publicKey || !selectedBalance) {
        setIsLoadingXdr(false);
        return;
      }

      try {
        setIsLoadingXdr(true);
        setTransactionError("");

        const xdr = await buildPaymentTransaction({
          publicKey,
          selectedBalance,
          tokenValue,
          address,
          transactionMemo,
          transactionFee,
          transactionTimeout,
          network,
        });

        if (isMounted && xdr) {
          setTransactionXdr(xdr);
          xdrGenerationAttempted.current = true;
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to build transaction:", errorMessage);

          setTransactionError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoadingXdr(false);
        }
      }
    };

    generateXdr();

    return () => {
      isMounted = false;
    };
  }, [
    publicKey,
    selectedBalance,
    tokenValue,
    address,
    transactionMemo,
    transactionFee,
    transactionTimeout,
    network,
    buildPaymentTransaction,
    setTransactionXdr,
    setIsLoadingXdr,
    setTransactionError,
  ]);

  const handleCopyXdr = () => {
    if (transactionXdr) {
      copyToClipboard(transactionXdr, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const renderXdrContent = () => {
    if (isLoadingXdr) {
      return t("common.loading");
    }

    if (transactionError) {
      return "Error";
    }

    if (transactionXdr) {
      return truncateAddress(transactionXdr, 10, 4);
    }

    return "--";
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
                  {formatAssetAmount(tokenValue, selectedBalance.tokenCode)}
                </Text>
                <Text md medium secondary>
                  {selectedBalance.currentPrice
                    ? formatFiatAmount(
                        new BigNumber(tokenValue).times(
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
            <Avatar size="lg" publicAddress={address} />
            <View className="flex-1">
              <Text xl medium>
                {slicedAddress}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View className="mt-[24px] rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
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
          <View className="flex-row items-center gap-[8px]">
            <Icon.File02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              {t("transactionAmountScreen.details.memo")}
            </Text>
          </View>
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
            disabled={
              isLoadingXdr || !transactionXdr || Boolean(transactionError)
            }
            className="flex-row items-center gap-[8px]"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text
              md
              medium
              secondary={isLoadingXdr || Boolean(transactionError)}
              className={transactionError ? "text-red-500" : ""}
            >
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
        <View className="flex-1">
          <Button
            onPress={onConfirm}
            tertiary
            xl
            disabled={isLoadingXdr || Boolean(transactionError)}
          >
            {t("common.confirm")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default SendReviewBottomSheet;
