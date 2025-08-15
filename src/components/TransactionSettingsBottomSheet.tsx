import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import { MIN_TRANSACTION_FEE, NATIVE_TOKEN_CODE } from "config/constants";
import { NetworkCongestion } from "config/types";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useValidateMemo } from "hooks/useValidateMemo";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";
import React, { useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type TransactionSettingsBottomSheetProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

const TransactionSettingsBottomSheet: React.FC<
  TransactionSettingsBottomSheetProps
> = ({ onCancel, onConfirm }) => {
  const { t } = useAppTranslation();
  const {
    transactionMemo,
    saveMemo,
    transactionTimeout,
    saveTransactionTimeout,
    transactionFee,
    saveTransactionFee,
  } = useTransactionSettingsStore();
  const timeoutInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const feeInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const memoInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { themeColors } = useColors();
  const { recommendedFee, networkCongestion } = useNetworkFees();
  const [localFee, setLocalFee] = useState(transactionFee ?? recommendedFee);
  const [localMemo, setLocalMemo] = useState(transactionMemo);
  const [localTimeout, setLocalTimeout] = useState(
    transactionTimeout.toString(),
  );
  const { error: memoError } = useValidateMemo(localMemo);
  const { error: feeError } = useValidateTransactionFee(localFee);
  const { error: timeoutError } = useValidateTransactionTimeout(localTimeout);

  const handleConfirm = () => {
    if (memoError || feeError || timeoutError) return;
    saveMemo(localMemo);
    saveTransactionTimeout(Number(localTimeout));
    saveTransactionFee(localFee);
    onConfirm();
  };

  const getLocalizedCongestionLevel = (
    congestion: NetworkCongestion,
  ): string => {
    switch (congestion) {
      case NetworkCongestion.LOW:
        return t("low");
      case NetworkCongestion.MEDIUM:
        return t("medium");
      case NetworkCongestion.HIGH:
        return t("high");
      default:
        return t("low");
    }
  };

  const bottomSheetsConfig = [
    {
      IconComponent: Icon.File02,
      key: "memoInfo" as const,
      modalRef: memoInfoBottomSheetModalRef,
      title: t("transactionSettingsBottomSheet.memoInfo.title"),
      onClose: () => memoInfoBottomSheetModalRef.current?.dismiss(),
    },
    {
      IconComponent: Icon.Route,
      key: "feeInfo" as const,
      modalRef: feeInfoBottomSheetModalRef,
      title: t("transactionSettingsBottomSheet.feeInfo.title"),
      onClose: () => feeInfoBottomSheetModalRef.current?.dismiss(),
    },
    {
      IconComponent: Icon.ClockRefresh,
      key: "timeoutInfo" as const,
      modalRef: timeoutInfoBottomSheetModalRef,
      title: t("transactionSettingsBottomSheet.timeoutInfo.title"),
      onClose: () => timeoutInfoBottomSheetModalRef.current?.dismiss(),
    },
  ];

  return (
    <View className="flex-1">
      <View className="flex-1 justify-between">
        <View className="flex flex-col gap-2">
          <View className="flex flex-row items-center gap-2">
            <Text sm secondary>
              {t("transactionSettingsBottomSheet.feeTitle")}
            </Text>
            <TouchableOpacity
              onPress={() => feeInfoBottomSheetModalRef.current?.present()}
            >
              <Icon.InfoCircle color={themeColors.gray[8]} size={16} />
            </TouchableOpacity>
          </View>
          <View className="flex flex-row mt-[4px] items-center gap-2">
            <Input
              isBottomSheetInput
              fieldSize="lg"
              value={localFee}
              leftElement={
                <Icon.Route size={16} color={themeColors.foreground.primary} />
              }
              onChangeText={setLocalFee}
              keyboardType="numeric"
              placeholder={MIN_TRANSACTION_FEE}
              error={feeError}
              rightElement={
                <Text md secondary>
                  {NATIVE_TOKEN_CODE}
                </Text>
              }
            />
          </View>
        </View>
        <View className="flex-row items-center gap-2 mt-2">
          <NetworkCongestionIndicator level={networkCongestion} size={16} />
          <Text sm secondary>
            {t("transactionFeeScreen.congestion", {
              networkCongestion: getLocalizedCongestionLevel(networkCongestion),
            })}
          </Text>
        </View>
      </View>

      <View className="flex flex-col gap-2 mt-[24px]">
        <View className="flex flex-row items-center gap-2">
          <Text sm secondary>
            {t("transactionSettingsBottomSheet.timeoutTitle")}
          </Text>
          <TouchableOpacity
            onPress={() => timeoutInfoBottomSheetModalRef.current?.present()}
          >
            <Icon.InfoCircle color={themeColors.gray[8]} size={16} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={
            <Icon.ClockRefresh
              size={16}
              color={themeColors.foreground.primary}
            />
          }
          placeholder={t("transactionTimeoutScreen.inputPlaceholder")}
          value={localTimeout}
          onChangeText={setLocalTimeout}
          keyboardType="numeric"
          error={timeoutError}
          rightElement={
            <Text md secondary>
              {t("transactionTimeoutScreen.seconds")}
            </Text>
          }
        />
      </View>

      <View className="flex-col gap-2 mt-[24px]">
        <View className="flex flex-row items-center gap-2">
          <Text sm secondary>
            {t("transactionSettingsBottomSheet.memoTitle")}
          </Text>
          <TouchableOpacity
            onPress={() => memoInfoBottomSheetModalRef.current?.present()}
          >
            <Icon.InfoCircle color={themeColors.gray[8]} size={16} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={
            <Icon.File02 size={16} color={themeColors.foreground.primary} />
          }
          placeholder={t("transactionMemoScreen.placeholder")}
          value={localMemo}
          onChangeText={setLocalMemo}
          error={memoError}
        />

        <View className="mt-[24px] gap-[12px] flex-row">
          <View className="flex-1">
            <Button onPress={onCancel} secondary xl>
              {t("common.cancel")}
            </Button>
          </View>
          <View className="flex-1">
            <Button
              tertiary
              xl
              onPress={handleConfirm}
              disabled={!!memoError || !!feeError || !!timeoutError}
            >
              {t("common.save")}
            </Button>
          </View>
        </View>
      </View>
      {bottomSheetsConfig.map(
        ({ IconComponent, modalRef, onClose, title, key }) => (
          <BottomSheet
            modalRef={modalRef}
            handleCloseModal={onClose}
            customContent={
              <InformationBottomSheet
                title={title}
                onClose={onClose}
                headerElement={
                  <View className="bg-lilac-3 p-2 rounded-[8px]">
                    <IconComponent color={themeColors.lilac[9]} size={28} />
                  </View>
                }
                texts={[
                  t(`transactionSettingsBottomSheet.${key}.description`),
                  t(`transactionSettingsBottomSheet.${key}.additionalInfo`),
                ]}
              />
            }
          />
        ),
      )}
    </View>
  );
};

export default TransactionSettingsBottomSheet;
