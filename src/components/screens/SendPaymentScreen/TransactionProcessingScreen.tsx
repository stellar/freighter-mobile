import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { BigNumber } from "bignumber.js";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { PricedBalance } from "config/types";
import { formatAssetAmount, formatFiatAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

// Transaction details component for the bottom sheet
type TransactionDetailsBottomSheetProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  address: string;
  slicedAddress: string;
};

const TransactionDetailsBottomSheet: React.FC<
  TransactionDetailsBottomSheetProps
> = ({ selectedBalance, tokenValue, address, slicedAddress }) => {
  const { themeColors } = useColors();

  // Get current date and time for the transaction
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = now
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  const dateTimeDisplay = `${formattedDate} · ${formattedTime}`;

  const handleViewOnExplorer = () => {
    // In the future, this could open a web link to stellar.expert with the transaction details
    console.log("View on stellar.expert");
  };

  return (
    <View className="gap-[24px]">
      {/* First section with transaction info */}
      <View className="flex-row gap-[16px]">
        {selectedBalance && <AssetIcon token={selectedBalance} size="lg" />}
        <View>
          <Text md medium primary>
            {`Sent ${selectedBalance?.tokenCode}`}
          </Text>
          <View className="flex-row items-center gap-[4px]">
            <Icon.ArrowCircleUp size={16} color={themeColors.text.secondary} />
            <Text sm medium secondary>
              {dateTimeDisplay}
            </Text>
          </View>
        </View>
      </View>

      {/* Gray box with transaction data */}
      <View className="bg-background-secondary rounded-[16px] p-[24px] gap-[12px]">
        {/* First row: Token amount and Asset icon */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {formatAssetAmount(tokenValue, selectedBalance?.tokenCode)}
            </Text>
            <Text md medium secondary>
              {formatFiatAmount(
                new BigNumber(tokenValue).times(
                  selectedBalance?.currentPrice || 0,
                ),
              )}
            </Text>
          </View>
          {selectedBalance && <AssetIcon token={selectedBalance} size="lg" />}
        </View>

        {/* Second row: Centered circle with chevron */}
        <View>
          <View className="w-[32px] h-[32px] rounded-full bg-tertiary justify-center items-center border border-gray-6">
            <Icon.ChevronDownDouble
              size={20}
              color={themeColors.foreground.primary}
            />
          </View>
        </View>

        {/* Third row: Recipient address info and avatar */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text xl medium primary>
              {slicedAddress}
            </Text>
            <Text md medium secondary>
              First time send
            </Text>
          </View>
          <Avatar size="lg" publicAddress={address} />
        </View>
      </View>

      {/* Transaction details box with border */}
      <View className="rounded-[16px] p-[24px] gap-[12px] bg-background-primary border-gray-6 border">
        {/* Status row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.ClockCheck size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              Status
            </Text>
          </View>
          <Text md medium style={{ color: themeColors.status.success }}>
            Success
          </Text>
        </View>

        {/* Rate row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Divide03 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              Rate
            </Text>
          </View>
          <Text md medium>
            {`1 ${selectedBalance?.tokenCode} ≈ ${selectedBalance?.currentPrice ? (1 / Number(selectedBalance.currentPrice)).toFixed(3) : "0.000"} USDC`}
          </Text>
        </View>

        {/* Fee row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-[8px]">
            <Icon.Route size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary>
              Fee
            </Text>
          </View>
          <Text md medium>
            0.00001 XLM
          </Text>
        </View>
      </View>

      {/* View on stellar.expert button */}
      <Button
        variant="tertiary"
        size="lg"
        onPress={handleViewOnExplorer}
        icon={
          <Icon.LinkExternal01
            size={16}
            color={themeColors.foreground.primary}
          />
        }
        iconPosition={IconPosition.RIGHT}
      >
        View on stellar.expert
      </Button>
    </View>
  );
};

type TransactionProcessingScreenProps = {
  selectedBalance: PricedBalance | undefined;
  tokenValue: string;
  address: string;
  onClose: () => void;
};

const TransactionProcessingScreen: React.FC<
  TransactionProcessingScreenProps
> = ({ selectedBalance, tokenValue, address, onClose }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const navigation = useNavigation();
  const slicedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const [isCompleted, setIsCompleted] = useState(false);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Hide the header when this component mounts
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Simulate transaction completion
  // This will be replaced with actual transaction logic in the future
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCompleted(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    // First call the original onClose function
    onClose();

    // Reset the navigation to the main tab and set the initial route to History
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK,
            state: {
              index: 0,
              routes: [{ name: MAIN_TAB_ROUTES.TAB_HISTORY }],
            },
          },
        ],
      }),
    );
  };

  const handleViewTransaction = () => {
    // Show transaction details in bottom sheet
    bottomSheetModalRef.current?.present();
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between">
        {/* Middle content */}
        <View className="flex-1 items-center justify-center">
          <View className="items-center gap-[8px]">
            {isCompleted ? (
              <Icon.CheckCircle size={48} color={themeColors.status.success} />
            ) : (
              <Spinner size="large" color={themeColors.base[1]} />
            )}

            <Display xs medium>
              {isCompleted
                ? t("transactionProcessingScreen.sent", "Sent!")
                : t("transactionProcessingScreen.sending")}
            </Display>

            <View className="rounded-[16px] p-[24px] gap-[24px] bg-background-secondary">
              <View className="flex-row items-center justify-center gap-[16px]">
                {selectedBalance && (
                  <AssetIcon token={selectedBalance} size="lg" />
                )}
                <Icon.ChevronRightDouble
                  size={16}
                  color={themeColors.text.secondary}
                />
                <Avatar size="lg" publicAddress={address} />
              </View>

              <View className="items-center">
                <View className="flex-row flex-wrap items-center justify-center">
                  <Text xl medium primary>
                    {formatAssetAmount(tokenValue, selectedBalance?.tokenCode)}
                  </Text>
                  <Text lg medium secondary>
                    {isCompleted ? " was sent to " : " to "}
                  </Text>
                  <Text xl medium primary>
                    {slicedAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom content */}
        {isCompleted ? (
          <View className="gap-[16px]">
            <Button
              variant="secondary"
              size="xl"
              onPress={handleViewTransaction}
            >
              {t(
                "transactionProcessingScreen.viewTransaction",
                "View transaction",
              )}
            </Button>
            <Button variant="tertiary" size="xl" onPress={handleClose}>
              {t("common.done", "Done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("transactionProcessingScreen.closeMessage")}
            </Text>
            <Button variant="secondary" size="xl" onPress={handleClose}>
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>

      {/* Transaction Details Bottom Sheet */}
      <BottomSheet
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        customContent={
          <TransactionDetailsBottomSheet
            selectedBalance={selectedBalance}
            tokenValue={tokenValue}
            address={address}
            slicedAddress={slicedAddress}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionProcessingScreen;
