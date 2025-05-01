import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import TransactionDetailsBottomSheet from "components/TransactionDetailsBottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { PricedBalance } from "config/types";
import { truncateAddress } from "helpers/formatAddress";
import { formatAssetAmount } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

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
  const slicedAddress = truncateAddress(address, 4, 4);
  const [isCompleted, setIsCompleted] = useState(false);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

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
    onClose();
  };

  const handleViewTransaction = () => {
    bottomSheetModalRef.current?.present();
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-between">
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
            <Button tertiary xl onPress={handleClose}>
              {t("common.done", "Done")}
            </Button>
          </View>
        ) : (
          <View className="gap-[16px]">
            <Text sm medium secondary textAlign="center">
              {t("transactionProcessingScreen.closeMessage")}
            </Text>
            <Button secondary xl onPress={handleClose}>
              {t("common.close")}
            </Button>
          </View>
        )}
      </View>

      <BottomSheet
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        customContent={
          <TransactionDetailsBottomSheet
            selectedBalance={selectedBalance}
            tokenValue={tokenValue}
            address={address}
          />
        }
      />
    </BaseLayout>
  );
};

export default TransactionProcessingScreen;
