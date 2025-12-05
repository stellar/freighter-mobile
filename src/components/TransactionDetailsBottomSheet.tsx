import { TransactionBuilder } from "@stellar/stellar-sdk";
import StellarLogo from "assets/logos/stellar-logo.svg";
import BigNumber from "bignumber.js";
import { CollectibleImage } from "components/CollectibleImage";
import { List, ListItemProps } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import { SendType } from "components/screens/SendScreen/components/SendReviewBottomSheet";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTransactionDate } from "helpers/date";
import {
  formatTokenForDisplay,
  formatFiatAmount,
  stroopToXlm,
} from "helpers/formatAmount";
import { truncateAddress, isMuxedAccount } from "helpers/stellar";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { getTransactionDetails, TransactionDetail } from "services/stellar";

/**
 * TransactionDetailsBottomSheet props
 *
 * @prop {string} [transactionAmount] - Transaction amount
 */
type TransactionDetailsBottomSheetProps = {
  type: "token" | "collectible";
  transactionAmount?: string;
};

/**
 * TransactionDetailsBottomSheet Component
 *
 * A bottom sheet displaying transaction details, including amount, recipient,
 * status, fee, and other transaction metadata.
 *
 * Uses data from Zustand stores to show real transaction information.
 */
const TransactionDetailsBottomSheet: React.FC<
  TransactionDetailsBottomSheetProps
> = ({ transactionAmount, type }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { open: openInAppBrowser } = useInAppBrowser();

  const {
    recipientAddress,
    selectedTokenId,
    transactionMemo,
    selectedCollectibleDetails,
  } = useTransactionSettingsStore();

  const {
    transactionXDR,
    transactionHash,
    error: transactionError,
    isSubmitting,
  } = useTransactionBuilderStore();

  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });
  const { getCollectible } = useCollectiblesStore();

  const selectedBalance = balanceItems.find(
    (item) => item.id === selectedTokenId,
  );

  const selectedCollectible = useMemo(
    () =>
      getCollectible({
        collectionAddress: selectedCollectibleDetails.collectionAddress,
        tokenId: selectedCollectibleDetails.tokenId,
      }),
    [
      selectedCollectibleDetails.collectionAddress,
      selectedCollectibleDetails.tokenId,
      getCollectible,
    ],
  );

  const transaction = TransactionBuilder.fromXDR(
    transactionXDR as string,
    network,
  );

  // Check if recipient is M address
  const isRecipientMuxed = Boolean(
    recipientAddress && isMuxedAccount(recipientAddress),
  );

  // Hide memo for M addresses (memo is encoded in the address)
  let memo = "";
  // Only extract memo from transaction or use stored memo if recipient is not an M address
  if (!isRecipientMuxed) {
    if ("memo" in transaction && transaction.memo.value) {
      memo = String(transaction.memo.value);
    } else if (transactionMemo) {
      memo = transactionMemo;
    }
  }

  const slicedAddress = truncateAddress(recipientAddress, 4, 4);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetail | null>(null);
  const actualFee = stroopToXlm(transactionDetails?.fee ?? 0).toString();

  useEffect(() => {
    if (transactionHash) {
      getTransactionDetails(transactionHash, network)
        .then((details) => {
          if (details) {
            setTransactionDetails(details);
          }
        })
        .catch((error) => {
          logger.error(
            "TransactionDetailsBottomSheet",
            "Failed to get transaction details",
            error,
          );
        });
    }
  }, [transactionHash, network]);

  const getTransactionStatus = () => {
    if (transactionHash) {
      return {
        text: t("transactionDetailsBottomSheet.statusSuccess"),
        color: themeColors.status.success,
      };
    }
    if (transactionError) {
      return {
        text: t("transactionDetailsBottomSheet.statusFailed"),
        color: themeColors.status.error,
      };
    }
    if (isSubmitting) {
      return {
        text: t("transactionDetailsBottomSheet.statusPending"),
        color: themeColors.status.warning,
      };
    }
    return {
      text: t("transactionDetailsBottomSheet.statusSuccess"),
      color: themeColors.status.success,
    };
  };

  const transactionStatus = getTransactionStatus();

  const dateTimeDisplay = formatTransactionDate(transactionDetails?.createdAt);

  const handleCopyXdr = () => {
    if (transactionXDR) {
      copyToClipboard(transactionXDR, {
        notificationMessage: t("common.copied"),
      });
    }
  };

  const handleViewOnExplorer = () => {
    if (!transactionHash) return;

    const explorerUrl = `${getStellarExpertUrl(network)}/tx/${transactionHash}`;

    openInAppBrowser(explorerUrl).catch((err) =>
      logger.error(
        "[Linking - openURL]",
        "Error opening transaction explorer:",
        err,
      ),
    );
  };

  return (
    <View className="gap-[24px]">
      <View className="flex-row gap-[16px]">
        {type === SendType.Token && selectedBalance && (
          <TokenIcon token={selectedBalance} size="lg" />
        )}
        {type === SendType.Collectible && selectedCollectible && (
          <View className="w-[40px] h-[40px] rounded-[8px] bg-background-tertiary overflow-hidden">
            <CollectibleImage
              imageUri={selectedCollectible?.image}
              placeholderIconSize={25}
            />
          </View>
        )}
        <View>
          <Text md medium primary>
            {type === SendType.Token &&
              t("transactionDetailsBottomSheet.sent", {
                tokenCode: selectedBalance?.tokenCode,
              })}
            {type === SendType.Collectible &&
              t("transactionDetailsBottomSheet.sentCollectible")}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        {type === SendType.Token && transactionAmount && (
          <View className="flex-row items-center">
            {selectedBalance && <TokenIcon token={selectedBalance} size="lg" />}
            <View className="ml-[16px]">
              <Text xl medium primary>
                {formatTokenForDisplay(
                  transactionAmount,
                  selectedBalance?.tokenCode,
                )}
              </Text>
              <Text md medium secondary>
                {selectedBalance?.currentPrice
                  ? formatFiatAmount(
                      new BigNumber(transactionAmount).times(
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

        <View>
          <View className="w-[40px] h-[40px] rounded-full bg-tertiary justify-center items-center">
            <Icon.ChevronDownDouble
              size={20}
              color={themeColors.foreground.primary}
            />
          </View>
        </View>

        <View className="flex-row items-center">
          <Avatar size="lg" publicAddress={recipientAddress} />
          <View className="ml-[16px]">
            <Text xl medium primary>
              {slicedAddress}
            </Text>
          </View>
        </View>
      </View>

      <List
        variant="secondary"
        items={
          [
            {
              icon: (
                <Icon.ClockCheck
                  size={16}
                  color={themeColors.foreground.primary}
                />
              ),
              titleComponent: (
                <Text md secondary color={THEME.colors.text.secondary}>
                  {t("transactionDetailsBottomSheet.status")}
                </Text>
              ),
              trailingContent: (
                <Text md medium color={transactionStatus.color}>
                  {transactionStatus.text}
                </Text>
              ),
            },
            // Hide memo line for M addresses (memo is encoded in the address)
            !isRecipientMuxed
              ? {
                  icon: (
                    <Icon.File02
                      size={16}
                      color={themeColors.foreground.primary}
                    />
                  ),
                  titleComponent: (
                    <Text md secondary color={THEME.colors.text.secondary}>
                      {t("transactionAmountScreen.details.memo")}
                    </Text>
                  ),
                  trailingContent: (
                    <Text md medium secondary={!memo}>
                      {memo || t("common.none")}
                    </Text>
                  ),
                }
              : undefined,
            {
              icon: (
                <Icon.Route size={16} color={themeColors.foreground.primary} />
              ),
              titleComponent: (
                <Text md secondary color={THEME.colors.text.secondary}>
                  {t("transactionAmountScreen.details.fee")}
                </Text>
              ),
              trailingContent: (
                <View className="flex-row items-center gap-[4px]">
                  <StellarLogo width={16} height={16} />
                  <Text md medium>
                    {formatTokenForDisplay(actualFee, NATIVE_TOKEN_CODE)}
                  </Text>
                </View>
              ),
            },
            {
              icon: (
                <Icon.FileCode02
                  size={16}
                  color={themeColors.foreground.primary}
                />
              ),
              titleComponent: (
                <Text md secondary color={THEME.colors.text.secondary}>
                  {t("transactionAmountScreen.details.xdr")}
                </Text>
              ),
              trailingContent: (
                <View
                  className="flex-row items-center gap-[8px]"
                  onTouchEnd={handleCopyXdr}
                >
                  <Icon.Copy01
                    size={16}
                    color={themeColors.foreground.primary}
                  />
                  <Text md medium>
                    {transactionXDR
                      ? truncateAddress(transactionXDR, 10, 4)
                      : t("common.none")}
                  </Text>
                </View>
              ),
            },
            // Filter out undefined entries to keep detail order
          ].filter(Boolean) as ListItemProps[]
        }
      />

      {transactionHash && (
        <Button
          tertiary
          xl
          onPress={handleViewOnExplorer}
          icon={
            <Icon.LinkExternal01
              size={16}
              color={themeColors.foreground.primary}
            />
          }
          iconPosition={IconPosition.RIGHT}
        >
          {t("transactionDetailsBottomSheet.viewOnExpert")}
        </Button>
      )}
    </View>
  );
};

export default TransactionDetailsBottomSheet;
