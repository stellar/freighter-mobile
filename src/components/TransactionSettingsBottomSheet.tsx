import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import InformationBottomSheet from "components/InformationBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import {
  MAX_SLIPPAGE,
  MIN_SLIPPAGE,
  MIN_TRANSACTION_FEE,
  NATIVE_TOKEN_CODE,
  TransactionSetting,
} from "config/constants";
import { NetworkCongestion } from "config/types";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useValidateMemo } from "hooks/useValidateMemo";
import { useValidateSlippage } from "hooks/useValidateSlippage";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";
import React, { useCallback, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Props for the TransactionSettingsBottomSheet component
 * @interface TransactionSettingsBottomSheetProps
 * @property {() => void} onCancel - Callback function when settings are cancelled
 * @property {() => void} onConfirm - Callback function when settings are confirmed
 * @property {TransactionSetting[]} settings - Array of settings to display
 */
type TransactionSettingsBottomSheetProps = {
  onCancel: () => void;
  onConfirm: () => void;
  settings: TransactionSetting[];
};

/**
 * TransactionSettingsBottomSheet Component
 *
 * A bottom sheet modal that allows users to configure transaction settings including:
 * - Transaction fee (with network congestion indicator)
 * - Transaction timeout
 * - Transaction memo
 *
 * Each setting includes validation and informational tooltips. The component
 * manages local state for each setting and only saves to the global store
 * when the user confirms the changes.
 *
 * @param {TransactionSettingsBottomSheetProps} props - Component props
 * @returns {JSX.Element} The rendered bottom sheet component
 *
 * @example
 * ```tsx
 * <TransactionSettingsBottomSheet
 *   onCancel={() => setShowSettings(false)}
 *   onConfirm={() => {
 *     // Settings saved, proceed with transaction
 *     setShowSettings(false);
 *   }}
 * />
 * ```
 */
const TransactionSettingsBottomSheet: React.FC<
  TransactionSettingsBottomSheetProps
> = ({ onCancel, onConfirm, settings }) => {
  const { t } = useAppTranslation();
  const {
    transactionMemo,
    saveMemo,
    transactionTimeout,
    saveTransactionTimeout,
    transactionFee,
    saveTransactionFee,
  } = useTransactionSettingsStore();

  const { swapSlippage, saveSwapSlippage } = useSwapSettingsStore();
  const timeoutInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const feeInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const memoInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const slippageInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { themeColors } = useColors();
  const { recommendedFee, networkCongestion } = useNetworkFees();
  const [localFee, setLocalFee] = useState(transactionFee ?? recommendedFee);
  const [localMemo, setLocalMemo] = useState(transactionMemo);
  const [localTimeout, setLocalTimeout] = useState(
    transactionTimeout.toString(),
  );
  const [localSlippage, setLocalSlippage] = useState(swapSlippage.toString());

  // Constants
  const STEP_SIZE_PERCENT = 0.5;

  const { error: memoError } = useValidateMemo(localMemo);
  const { error: feeError } = useValidateTransactionFee(localFee);
  const { error: timeoutError } = useValidateTransactionTimeout(localTimeout);
  const { error: slippageError } = useValidateSlippage(localSlippage);

  /**
   * Updates slippage value
   * @param value - The numeric value (without %)
   */
  const updateSlippage = useCallback((value: string) => {
    setLocalSlippage(value);
  }, []);

  /**
   * Handles slippage increment/decrement with a specified step
   * @param step - The step size to add/subtract (positive for increment, negative for decrement)
   */
  const handleUpdateSlippage = useCallback(
    (step: number) => {
      // Parse the current value, handling locale-specific separators
      const normalizedValue = localSlippage.replace(",", ".");
      const currentValue = parseFloat(normalizedValue) || 0;
      const newValue = Math.max(0, Math.min(MAX_SLIPPAGE, currentValue + step));

      const roundedValue = Math.round(newValue * 100) / 100;

      const isWholeNumber = roundedValue % 1 === 0;
      const finalValue = isWholeNumber
        ? Math.round(roundedValue)
        : roundedValue;

      // Format with locale-specific separators
      const formattedValue = finalValue.toString().replace(".", ",");
      updateSlippage(formattedValue);
    },
    [localSlippage, updateSlippage],
  );

  /**
   * Handles text input changes
   * @param text - The input text
   */
  const handleSlippageTextChange = useCallback((text: string) => {
    // Remove % if user types it
    const numericValue = text.replace("%", "");
    // Allow both comma and dot as decimal separators for manual input
    setLocalSlippage(numericValue);
  }, []);

  // Memoize other onChangeText handlers to prevent re-renders
  const handleMemoChange = useCallback((text: string) => {
    setLocalMemo(text);
  }, []);

  const handleFeeChange = useCallback((text: string) => {
    setLocalFee(text);
  }, []);

  const handleTimeoutChange = useCallback((text: string) => {
    setLocalTimeout(text);
  }, []);

  /**
   * Error mapping for each setting type
   */
  const settingErrors = {
    [TransactionSetting.Memo]: memoError,
    [TransactionSetting.Slippage]: slippageError,
    [TransactionSetting.Fee]: feeError,
    [TransactionSetting.Timeout]: timeoutError,
  };

  /**
   * Save callbacks for each setting type
   */
  const settingSaveCallbacks = {
    [TransactionSetting.Memo]: () => saveMemo(localMemo),
    [TransactionSetting.Slippage]: () =>
      saveSwapSlippage(Number(localSlippage)),
    [TransactionSetting.Fee]: () => saveTransactionFee(localFee),
    [TransactionSetting.Timeout]: () =>
      saveTransactionTimeout(Number(localTimeout)),
  };

  /**
   * Converts network congestion level to localized string
   *
   * @param {NetworkCongestion} congestion - The network congestion level
   * @returns {string} Localized string representation of congestion level
   */
  const getLocalizedCongestionLevel = useCallback(
    (congestion: NetworkCongestion): string => {
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
    },
    [t],
  );

  /**
   * Individual row component functions - memoized to prevent re-renders
   */
  const getMemoRow = useCallback(
    () => (
      <View className="flex-col gap-2 mt-[24px]">
        <View className="flex flex-row items-center gap-2">
          <Text sm secondary>
            {t("transactionSettings.memoTitle")}
          </Text>
          <TouchableOpacity
            onPress={() => memoInfoBottomSheetModalRef.current?.present()}
          >
            <Icon.InfoCircle color={themeColors.gray[8]} size={pxValue(16)} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={
            <Icon.File02
              size={pxValue(16)}
              color={themeColors.foreground.primary}
            />
          }
          placeholder={t("transactionSettings.memoPlaceholder")}
          value={localMemo}
          onChangeText={handleMemoChange}
          error={memoError}
        />
      </View>
    ),
    [
      localMemo,
      memoError,
      t,
      themeColors.foreground.primary,
      themeColors.gray,
      handleMemoChange,
    ],
  );

  const getSlippageRow = useCallback(
    () => (
      <View className="flex-col gap-2 mt-[24px]">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-2">
            <Text sm secondary>
              {t("transactionSettings.slippageTitle")}
            </Text>
            <TouchableOpacity
              onPress={() => slippageInfoBottomSheetModalRef.current?.present()}
            >
              <Icon.InfoCircle color={themeColors.gray[8]} size={pxValue(16)} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => updateSlippage("1")}>
            <Text sm medium color={themeColors.lilac[11]}>
              {t("transactionSettings.resetFee")}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex flex-row items-start gap-2">
          <View className="mt-2">
            <IconButton
              Icon={Icon.Minus}
              size="md"
              variant="secondary"
              onPress={() => handleUpdateSlippage(-STEP_SIZE_PERCENT)}
              disabled={
                (parseFloat(localSlippage.replace(",", ".")) || 0) <=
                MIN_SLIPPAGE
              }
            />
          </View>

          <View className="flex-1">
            <Input
              isBottomSheetInput
              fieldSize="lg"
              placeholder={t("transactionSettings.slippagePlaceholder")}
              value={localSlippage}
              onChangeText={handleSlippageTextChange}
              keyboardType="numeric"
              error={slippageError}
              inputSuffixDisplay="%"
              centered
            />
          </View>

          <View className="mt-2">
            <IconButton
              Icon={Icon.Plus}
              size="md"
              variant="secondary"
              onPress={() => handleUpdateSlippage(STEP_SIZE_PERCENT)}
              disabled={
                (parseFloat(localSlippage.replace(",", ".")) || 0) >=
                MAX_SLIPPAGE
              }
            />
          </View>
        </View>
      </View>
    ),
    [
      localSlippage,
      slippageError,
      t,
      themeColors.lilac,
      handleUpdateSlippage,
      handleSlippageTextChange,
      STEP_SIZE_PERCENT,

      themeColors.gray,
      updateSlippage,
    ],
  );

  const getFeeRow = useCallback(
    () => (
      <View className="flex flex-col gap-2">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-2">
            <Text sm secondary>
              {t("transactionSettings.feeTitle")}
            </Text>
            <TouchableOpacity
              onPress={() => feeInfoBottomSheetModalRef.current?.present()}
            >
              <Icon.InfoCircle color={themeColors.gray[8]} size={pxValue(16)} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setLocalFee(recommendedFee)}>
            <Text sm medium color={themeColors.lilac[11]}>
              {t("transactionSettings.resetFee")}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex flex-row mt-[4px] items-center gap-2">
          <Input
            isBottomSheetInput
            fieldSize="lg"
            value={localFee}
            leftElement={
              <Icon.Route
                size={pxValue(16)}
                color={themeColors.foreground.primary}
              />
            }
            onChangeText={handleFeeChange}
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
        <View className="flex-row items-center gap-2 mt-2">
          <NetworkCongestionIndicator
            level={networkCongestion}
            size={pxValue(16)}
          />
          <Text sm secondary>
            {t("transactionSettings.congestion", {
              networkCongestion: getLocalizedCongestionLevel(networkCongestion),
            })}
          </Text>
        </View>
      </View>
    ),
    [
      localFee,
      feeError,
      t,
      themeColors.foreground.primary,
      themeColors.lilac,
      recommendedFee,
      networkCongestion,
      getLocalizedCongestionLevel,
      handleFeeChange,
      themeColors.gray,
    ],
  );

  const getTimeoutRow = useCallback(
    () => (
      <View className="flex flex-col gap-2 mt-[24px]">
        <View className="flex flex-row items-center gap-2">
          <Text sm secondary>
            {t("transactionSettings.timeoutTitle")}
          </Text>
          <TouchableOpacity
            onPress={() => timeoutInfoBottomSheetModalRef.current?.present()}
          >
            <Icon.InfoCircle color={themeColors.gray[8]} size={pxValue(16)} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={
            <Icon.ClockRefresh
              size={pxValue(16)}
              color={themeColors.foreground.primary}
            />
          }
          placeholder={t("transactionSettings.timeoutPlaceholder")}
          value={localTimeout}
          onChangeText={handleTimeoutChange}
          keyboardType="numeric"
          error={timeoutError}
          rightElement={
            <Text md secondary>
              {t("transactionSettings.seconds")}
            </Text>
          }
        />
      </View>
    ),
    [
      localTimeout,
      timeoutError,
      t,
      themeColors.foreground.primary,
      themeColors.gray,
      handleTimeoutChange,
    ],
  );

  /**
   * Handles confirmation of transaction settings
   * Validates all inputs and saves to global store if valid
   */
  const handleConfirm = () => {
    // Check for errors in enabled settings only
    const hasErrors = settings.some((setting) => settingErrors[setting]);

    if (hasErrors) return;

    // Save settings dynamically using callbacks
    settings.forEach((setting) => {
      const saveCallback = settingSaveCallbacks[setting];
      if (saveCallback) {
        saveCallback();
      }
    });

    onConfirm();
  };

  /**
   * Configuration for information bottom sheets
   * Each setting has its own info modal with icon, title, and content
   */
  const bottomSheetsConfig = [
    {
      IconComponent: Icon.File02,
      key: "memoInfo" as const,
      modalRef: memoInfoBottomSheetModalRef,
      title: t("transactionSettings.memoInfo.title"),
      onClose: () => memoInfoBottomSheetModalRef.current?.dismiss(),
      texts: [
        {
          key: "description",
          value: t("transactionSettings.memoInfo.description"),
        },
        {
          key: "additionalInfo",
          value: t("transactionSettings.memoInfo.additionalInfo"),
        },
      ],
    },
    {
      IconComponent: Icon.CoinsSwap01,
      key: "slippageInfo" as const,
      modalRef: slippageInfoBottomSheetModalRef,
      title: t("transactionSettings.slippageInfo.title"),
      onClose: () => slippageInfoBottomSheetModalRef.current?.dismiss(),
      texts: [
        {
          key: "description",
          value: t("transactionSettings.slippageInfo.description"),
        },
      ],
    },
    {
      IconComponent: Icon.Route,
      key: "feeInfo" as const,
      modalRef: feeInfoBottomSheetModalRef,
      title: t("transactionSettings.feeInfo.title"),
      onClose: () => feeInfoBottomSheetModalRef.current?.dismiss(),
      texts: [
        {
          key: "description",
          value: t("transactionSettings.feeInfo.description"),
        },
        {
          key: "additionalInfo",
          value: t("transactionSettings.feeInfo.additionalInfo"),
        },
      ],
    },
    {
      IconComponent: Icon.ClockRefresh,
      key: "timeoutInfo" as const,
      modalRef: timeoutInfoBottomSheetModalRef,
      title: t("transactionSettings.timeoutInfo.title"),
      onClose: () => timeoutInfoBottomSheetModalRef.current?.dismiss(),
      texts: [
        {
          key: "description",
          value: t("transactionSettings.timeoutInfo.description"),
        },
        {
          key: "additionalInfo",
          value: t("transactionSettings.timeoutInfo.additionalInfo"),
        },
      ],
    },
  ];

  return (
    <View className="flex-1">
      <View className="flex-1 justify-between">
        <View className="flex flex-col gap-2">
          {/* Render settings directly based on settings array */}
          {settings.includes(TransactionSetting.Fee) && getFeeRow()}
          {settings.includes(TransactionSetting.Timeout) && getTimeoutRow()}
          {settings.includes(TransactionSetting.Slippage) && getSlippageRow()}
          {settings.includes(TransactionSetting.Memo) && getMemoRow()}
        </View>
      </View>

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
            disabled={settings.some((setting) => settingErrors[setting])}
          >
            {t("common.save")}
          </Button>
        </View>
      </View>

      {bottomSheetsConfig.map(
        ({ IconComponent, modalRef, onClose, title, key, texts }) => (
          <BottomSheet
            key={key}
            modalRef={modalRef}
            handleCloseModal={onClose}
            customContent={
              <InformationBottomSheet
                title={title}
                onClose={onClose}
                headerElement={
                  <View className="bg-lilac-3 p-2 rounded-[8px]">
                    <IconComponent
                      color={themeColors.lilac[9]}
                      size={pxValue(28)}
                    />
                  </View>
                }
                texts={texts}
              />
            }
          />
        ),
      )}
    </View>
  );
};

export default TransactionSettingsBottomSheet;
