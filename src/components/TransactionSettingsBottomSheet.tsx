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
  TransactionContext,
  TransactionSetting,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { NetworkCongestion } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import {
  parseDisplayNumber,
  formatNumberForDisplay,
} from "helpers/formatAmount";
import { getMemoDisabledState } from "helpers/muxedAddress";
import { isContractId } from "helpers/soroban";
import { isMuxedAccount } from "helpers/stellar";
import { enforceSettingInputDecimalSeparator } from "helpers/transactionSettingsUtils";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import { useInitialRecommendedFee } from "hooks/useInitialRecommendedFee";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useValidateMemo } from "hooks/useValidateMemo";
import { useValidateSlippage } from "hooks/useValidateSlippage";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";
import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { TouchableOpacity, View } from "react-native";

type TransactionSettingsBottomSheetProps = {
  onCancel: () => void;
  onConfirm: () => void;
  context: TransactionContext;
  onSettingsChange?: () => void;
};

// Constants
const STEP_SIZE_PERCENT = 0.5;

const TransactionSettingsBottomSheet: React.FC<
  TransactionSettingsBottomSheetProps
> = ({ onCancel, onConfirm, context, onSettingsChange }) => {
  // All hooks at the top
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recommendedFee, networkCongestion } = useNetworkFees();

  const {
    transactionMemo,
    transactionFee,
    transactionTimeout,
    recipientAddress,
    selectedTokenId,
    selectedCollectibleDetails,
    saveMemo: saveTransactionMemo,
    saveTransactionFee,
    saveTransactionTimeout,
  } = useTransactionSettingsStore();

  const {
    swapFee,
    swapTimeout,
    swapSlippage,
    saveSwapFee,
    saveSwapTimeout,
    saveSwapSlippage,
  } = useSwapSettingsStore();

  const { markAsManuallyChanged } = useInitialRecommendedFee(
    recommendedFee,
    context,
  );

  const timeoutInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const feeInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const memoInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const slippageInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { network, account } = useAuthenticationStore();

  // Get selected balance to check if it's a custom token
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
  });
  const selectedBalance = balanceItems.find(
    (item) => item.id === (selectedTokenId || NATIVE_TOKEN_CODE),
  );
  const isCustomToken = Boolean(
    selectedBalance &&
      "contractId" in selectedBalance &&
      Boolean(selectedBalance.contractId),
  );

  const isCollectibleTransfer =
    Boolean(selectedCollectibleDetails?.collectionAddress) &&
    Boolean(selectedCollectibleDetails?.tokenId);

  const isSorobanRecipient = Boolean(
    recipientAddress && isContractId(recipientAddress),
  );

  // Soroban transaction: collectible transfer, custom token, or recipient is contract address
  const isSorobanTransaction = Boolean(
    isCollectibleTransfer || isCustomToken || isSorobanRecipient,
  );

  // Check if destination is already a muxed account (M address)
  const isDestinationMuxed = Boolean(
    recipientAddress && isMuxedAccount(recipientAddress),
  );

  // Determine contract ID for Soroban transactions
  const contractId = useMemo(() => {
    if (!isSorobanTransaction || !recipientAddress) {
      return undefined;
    }

    if (isCollectibleTransfer) {
      return selectedCollectibleDetails?.collectionAddress;
    }

    if (isCustomToken && selectedBalance && "contractId" in selectedBalance) {
      return selectedBalance.contractId;
    }

    if (isSorobanRecipient) {
      return recipientAddress;
    }

    return undefined;
  }, [
    isSorobanTransaction,
    recipientAddress,
    isCollectibleTransfer,
    isCustomToken,
    isSorobanRecipient,
    selectedCollectibleDetails?.collectionAddress,
    selectedBalance,
  ]);

  // Get memo disabled state using the helper
  const [memoState, setMemoState] = useState<{
    isMemoDisabled: boolean;
    memoDisabledMessage?: string;
  }>({ isMemoDisabled: false });

  useEffect(() => {
    const updateMemoState = async () => {
      if (!account?.publicKey || !recipientAddress) {
        setMemoState({ isMemoDisabled: false });
        return;
      }

      const networkDetails = network
        ? mapNetworkToNetworkDetails(network)
        : undefined;

      const state = await getMemoDisabledState({
        targetAddress: recipientAddress,
        contractId,
        networkDetails,
        t,
      });

      setMemoState(state);
    };

    updateMemoState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.publicKey, recipientAddress, contractId, network]);

  const { isMemoDisabled, memoDisabledMessage } = memoState;

  // Derived values based on context
  const memo = context === TransactionContext.Swap ? "" : transactionMemo;
  const storeFee =
    context === TransactionContext.Swap ? swapFee : transactionFee;

  const timeout =
    context === TransactionContext.Swap ? swapTimeout : transactionTimeout;
  const slippage = context === TransactionContext.Swap ? swapSlippage : 1;

  const settings =
    context === TransactionContext.Swap
      ? [
          TransactionSetting.Fee,
          TransactionSetting.Timeout,
          TransactionSetting.Slippage,
        ]
      : [
          TransactionSetting.Fee,
          TransactionSetting.Timeout,
          TransactionSetting.Memo,
        ];

  // State hooks
  const [localFee, setLocalFee] = useState(formatNumberForDisplay(storeFee));
  const [localMemo, setLocalMemo] = useState(memo);
  const [localTimeout, setLocalTimeout] = useState(timeout.toString());
  const [localSlippage, setLocalSlippage] = useState(
    enforceSettingInputDecimalSeparator(slippage.toString()),
  );

  useEffect(() => {
    if (isMemoDisabled && localMemo) {
      setLocalMemo("");
      saveTransactionMemo("");
    }
  }, [isMemoDisabled, localMemo, saveTransactionMemo]);

  // Validation hooks
  const { error: memoError } = useValidateMemo(localMemo);
  const { error: feeError } = useValidateTransactionFee(localFee);
  const { error: timeoutError } = useValidateTransactionTimeout(localTimeout);
  const { error: slippageError } = useValidateSlippage(localSlippage);

  // Callback functions
  const saveMemo = useCallback(
    (value: string) => {
      // Only save memo if it's not disabled (destination is not already muxed)
      if (!isMemoDisabled) {
        saveTransactionMemo(value);
      }
    },
    [saveTransactionMemo, isMemoDisabled],
  );

  const saveFee = useCallback(
    (value: string) => {
      if (context === TransactionContext.Swap) {
        saveSwapFee(value);
      } else {
        saveTransactionFee(value);
      }
    },
    [context, saveSwapFee, saveTransactionFee],
  );

  const saveTimeout = useCallback(
    (value: number) => {
      if (context === TransactionContext.Swap) {
        saveSwapTimeout(value);
      } else {
        saveTransactionTimeout(value);
      }
    },
    [context, saveSwapTimeout, saveTransactionTimeout],
  );

  const saveSlippage = useCallback(
    (value: number) => {
      if (context === TransactionContext.Swap) {
        saveSwapSlippage(value);
      }
    },
    [context, saveSwapSlippage],
  );

  const updateSlippage = useCallback((value: string) => {
    setLocalSlippage(value);
  }, []);

  const handleUpdateSlippage = useCallback(
    (step: number) => {
      const currentValue = parseDisplayNumber(localSlippage) || 0;
      const newValue = Math.max(
        0,
        Math.min(MAX_SLIPPAGE, Number(currentValue) + step),
      );
      const roundedValue = Math.round(newValue * 100) / 100;
      const isWholeNumber = roundedValue % 1 === 0;
      const finalValue = isWholeNumber
        ? Math.round(roundedValue)
        : roundedValue;
      const formattedValue = enforceSettingInputDecimalSeparator(
        finalValue.toString(),
      );
      updateSlippage(formattedValue);
    },
    [localSlippage, updateSlippage],
  );

  const handleSlippageTextChange = useCallback((text: string) => {
    const numericValue = enforceSettingInputDecimalSeparator(text);
    setLocalSlippage(numericValue);
  }, []);
  const handleMemoChange = useCallback(
    (text: string) => {
      // Prevent memo changes if destination is already muxed
      if (!isMemoDisabled) {
        setLocalMemo(text);
      }
    },
    [isMemoDisabled],
  );

  const handleFeeChange = useCallback((text: string) => {
    const normalizedText = enforceSettingInputDecimalSeparator(text);
    setLocalFee(normalizedText);
  }, []);

  const handleTimeoutChange = useCallback((text: string) => {
    const integerOnly = text.replace(/[^\d]/g, "");
    setLocalTimeout(integerOnly);
  }, []);

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

  // Data objects and configurations
  const settingErrors = {
    [TransactionSetting.Memo]: memoError,
    [TransactionSetting.Slippage]: slippageError,
    [TransactionSetting.Fee]: feeError,
    [TransactionSetting.Timeout]: timeoutError,
  };

  const settingSaveCallbacks = {
    [TransactionSetting.Memo]: () => saveMemo(localMemo),
    [TransactionSetting.Slippage]: () =>
      saveSlippage(Number(parseDisplayNumber(localSlippage))),
    [TransactionSetting.Fee]: () => {
      markAsManuallyChanged();
      saveFee(parseDisplayNumber(localFee).toString());
    },
    [TransactionSetting.Timeout]: () => saveTimeout(Number(localTimeout)),
  };

  const handleConfirm = () => {
    const hasErrors = settings.some((setting) => settingErrors[setting]);
    if (hasErrors) return;

    settings.forEach((setting) => {
      settingSaveCallbacks[setting]();
    });

    // Notify that settings have changed
    onSettingsChange?.();

    onConfirm();
  };

  // Render functions
  const memoNote = useMemo(() => {
    // Only show message when memo is disabled
    if (isMemoDisabled && memoDisabledMessage) {
      return (
        <Text sm color={themeColors.status.warning}>
          {memoDisabledMessage}
        </Text>
      );
    }
    return undefined;
  }, [isMemoDisabled, memoDisabledMessage, themeColors.status.warning]);

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
            <Icon.InfoCircle themeColor="gray" size={16} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={<Icon.File02 size={16} themeColor="gray" />}
          placeholder={t("transactionSettings.memoPlaceholder")}
          value={localMemo}
          onChangeText={handleMemoChange}
          error={isMemoDisabled ? undefined : memoError}
          editable={!isMemoDisabled}
          note={memoNote}
        />
      </View>
    ),
    [localMemo, memoError, t, handleMemoChange, memoNote, isMemoDisabled],
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
              <Icon.InfoCircle themeColor="gray" size={16} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => updateSlippage("1")}>
            <Text sm medium color={themeColors.lilac[11]}>
              {t("transactionSettings.resetFee")}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex flex-row items-start gap-2">
          <View className="mt-[5px]">
            <IconButton
              Icon={Icon.Minus}
              size="md"
              variant="secondary"
              onPress={() => handleUpdateSlippage(-STEP_SIZE_PERCENT)}
              disabled={
                (Number(parseDisplayNumber(localSlippage)) || 0) <= MIN_SLIPPAGE
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

          <View className="mt-[5px]">
            <IconButton
              Icon={Icon.Plus}
              size="md"
              variant="secondary"
              onPress={() => handleUpdateSlippage(STEP_SIZE_PERCENT)}
              disabled={
                (Number(parseDisplayNumber(localSlippage)) || 0) >= MAX_SLIPPAGE
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
              <Icon.InfoCircle themeColor="gray" size={16} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              markAsManuallyChanged();
              setLocalFee(
                formatNumberForDisplay(recommendedFee || MIN_TRANSACTION_FEE),
              );
            }}
          >
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
            leftElement={<Icon.Route size={16} themeColor="gray" />}
            onChangeText={handleFeeChange}
            keyboardType="numeric"
            placeholder={formatNumberForDisplay(MIN_TRANSACTION_FEE)}
            error={feeError}
            note={
              <View className="flex-row items-center gap-2">
                <NetworkCongestionIndicator
                  level={networkCongestion}
                  size={16}
                />

                <View className="h-6">
                  <Text sm secondary>
                    {t("transactionSettings.congestion", {
                      networkCongestion:
                        getLocalizedCongestionLevel(networkCongestion),
                    })}
                  </Text>
                </View>
              </View>
            }
            rightElement={
              <Text md secondary>
                {NATIVE_TOKEN_CODE}
              </Text>
            }
          />
        </View>
      </View>
    ),
    [
      localFee,
      feeError,
      t,
      themeColors.lilac,
      networkCongestion,
      getLocalizedCongestionLevel,
      handleFeeChange,
      recommendedFee,
      markAsManuallyChanged,
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
            <Icon.InfoCircle themeColor="gray" size={16} />
          </TouchableOpacity>
        </View>
        <Input
          isBottomSheetInput
          fieldSize="lg"
          leftElement={<Icon.ClockRefresh size={16} themeColor="gray" />}
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
    [localTimeout, timeoutError, t, handleTimeoutChange],
  );

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
        {
          key: "sorobanInfo",
          value: t("transactionSettings.memoInfo.sorobanInfo"),
        },
        ...(isDestinationMuxed
          ? [
              {
                key: "muxedAddressInfo",
                value: t("transactionSettings.memoInfo.muxedAddressInfo"),
              },
            ]
          : []),
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
                    <IconComponent color={themeColors.lilac[9]} size={28} />
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
