import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import BottomSheet from "components/BottomSheet";
import { IconButton } from "components/IconButton";
import InformationBottomSheet from "components/InformationBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import SegmentedControl from "components/sds/SegmentedControl";
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
import { FeePresets, FeePriority } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapSettingsStore } from "ducks/swapSettings";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import {
  parseDisplayNumber,
  formatNumberForDisplay,
} from "helpers/formatAmount";
import { getMemoDisabledState } from "helpers/muxedAddress";
import { isContractId } from "helpers/soroban";
import { enforceSettingInputDecimalSeparator } from "helpers/transactionSettingsUtils";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import { useFeeDetailsBottomSheet } from "hooks/useFeeDetailsBottomSheet";
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
import { Keyboard, TouchableOpacity, View } from "react-native";

type TransactionSettingsBottomSheetProps = {
  onCancel: () => void;
  onConfirm: () => void;
  context: TransactionContext;
  onSettingsChange?: () => void;
  /**
   * Number of operations the transaction bundles. The fee is the TOTAL across
   * all ops, so the recommended default scales by this and the minimum is
   * `operationCount × MIN_TRANSACTION_FEE` (a 2-op swap-to-new-token can't
   * total below 2 × the network per-op minimum). Defaults to 1 (single-op).
   */
  operationCount?: number;
};

// Constants
const STEP_SIZE_PERCENT = 0.5;
const PRESET_PRIORITIES: Array<keyof FeePresets> = [
  FeePriority.LOW,
  FeePriority.MEDIUM,
  FeePriority.HIGH,
];

const TransactionSettingsBottomSheet: React.FC<
  TransactionSettingsBottomSheetProps
> = ({
  onCancel,
  onConfirm,
  context,
  onSettingsChange,
  operationCount = 1,
}) => {
  // All hooks at the top
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { recommendedFee, networkCongestion, feePresets } = useNetworkFees();

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
    feePriority: txFeePriority,
    saveFeePriority: saveTxFeePriority,
  } = useTransactionSettingsStore();

  const {
    swapFee,
    swapTimeout,
    swapSlippage,
    saveSwapFee,
    saveSwapTimeout,
    saveSwapSlippage,
    feePriority: swapFeePriority,
    saveFeePriority: saveSwapFeePriority,
  } = useSwapSettingsStore();

  const { markAsManuallyChanged } = useInitialRecommendedFee(
    recommendedFee,
    context,
    operationCount,
    networkCongestion,
  );

  const timeoutInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
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

  const isCollectibleTransfer =
    Boolean(selectedCollectibleDetails?.collectionAddress) &&
    Boolean(selectedCollectibleDetails?.tokenId);

  // Keep isCustomToken for contractId determination below
  const isCustomToken = Boolean(
    selectedBalance &&
      "contractId" in selectedBalance &&
      Boolean(selectedBalance.contractId),
  );

  const isSorobanRecipient = Boolean(
    recipientAddress && isContractId(recipientAddress),
  );

  // Derived from current context parameters (balance, recipient, collectible)
  // rather than the builder store, which may be stale or reflect a different
  // transaction flow (e.g. a previous send or a swap transaction).
  const isSorobanTransaction = Boolean(
    isCollectibleTransfer || isCustomToken || isSorobanRecipient,
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
  const storeFeePriority =
    context === TransactionContext.Swap ? swapFeePriority : txFeePriority;
  const saveFeePriorityForContext =
    context === TransactionContext.Swap
      ? saveSwapFeePriority
      : saveTxFeePriority;

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

  // Each op needs at least MIN_TRANSACTION_FEE, so a multi-op transaction (e.g.
  // a swap-to-new-token's changeTrust + path payment) floors the total at
  // operationCount × that.
  const minTotalFee = new BigNumber(MIN_TRANSACTION_FEE).times(operationCount);
  const storeFeeBn = new BigNumber(storeFee);
  const flooredStoreFee = formatNumberForDisplay(
    (storeFeeBn.isFinite()
      ? BigNumber.max(storeFeeBn, minTotalFee)
      : minTotalFee
    ).toString(),
  );

  // Presets are per-op rates; the shown/stored fee is the TOTAL across all ops.
  // Returns undefined when the preset hasn't loaded yet (empty/NaN), e.g. on a
  // cold start before the first feeStats fetch resolves.
  const presetTotalFee = (priority: keyof FeePresets): string | undefined => {
    const preset = feePresets[priority];
    if (!preset || new BigNumber(preset).isNaN()) {
      return undefined;
    }
    return new BigNumber(preset).times(operationCount).toString();
  };

  // The selected tier. Until the user interacts, it mirrors the stored tier
  // (set from network congestion once the frozen fee snapshot lands), so the
  // tab, the shown fee, and the congestion icon stay consistent during the
  // initial load instead of the tab sticking while the others update. Once the
  // user picks a tier or types, their choice sticks (no further syncing).
  const feeInteractedRef = useRef(false);
  const [selectedFeePriority, setSelectedFeePriority] =
    useState<FeePriority>(storeFeePriority);
  useEffect(() => {
    if (!feeInteractedRef.current) {
      setSelectedFeePriority(storeFeePriority);
    }
  }, [storeFeePriority]);
  // The editable value, used while on the "Custom" tier.
  const [customFee, setCustomFee] = useState(flooredStoreFee);
  const [localMemo, setLocalMemo] = useState(memo);
  const [localTimeout, setLocalTimeout] = useState(timeout.toString());
  const [localSlippage, setLocalSlippage] = useState(
    enforceSettingInputDecimalSeparator(slippage.toString()),
  );

  // The value shown in the input: for a preset tier it's the current preset
  // total (kept in step with refetched fees); for Custom it's the editable
  // amount. (Falls back to the floored store fee if the preset hasn't loaded.)
  const presetTotal =
    selectedFeePriority === FeePriority.CUSTOM
      ? undefined
      : presetTotalFee(selectedFeePriority);
  const localFee =
    selectedFeePriority === FeePriority.CUSTOM
      ? customFee
      : (presetTotal && formatNumberForDisplay(presetTotal)) || flooredStoreFee;

  useEffect(() => {
    if (isMemoDisabled && localMemo) {
      setLocalMemo("");
      saveTransactionMemo("");
    }
  }, [isMemoDisabled, localMemo, saveTransactionMemo]);

  // Validation hooks
  const { error: memoError } = useValidateMemo(localMemo);
  const { error: feeError } = useValidateTransactionFee(
    localFee,
    operationCount,
  );
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
    // Manual typing is only possible on the Custom tier; update its value.
    feeInteractedRef.current = true;
    const normalizedText = enforceSettingInputDecimalSeparator(text);
    setCustomFee(normalizedText);
  }, []);

  const handleTimeoutChange = useCallback((text: string) => {
    const integerOnly = text.replace(/[^\d]/g, "");
    setLocalTimeout(integerOnly);
  }, []);

  const feePriorityOptions = useMemo(
    () => [
      { label: t("transactionSettings.priorityLow"), value: FeePriority.LOW },
      {
        label: t("transactionSettings.priorityMed"),
        value: FeePriority.MEDIUM,
      },
      { label: t("transactionSettings.priorityHigh"), value: FeePriority.HIGH },
      {
        label: t("transactionSettings.priorityCustom"),
        value: FeePriority.CUSTOM,
      },
    ],
    [t],
  );

  const areFeePresetsLoaded = useMemo(
    () => PRESET_PRIORITIES.every((priority) => !!feePresets[priority]),
    [feePresets],
  );

  const handleFeePriorityChange = useCallback(
    (value: string | number) => {
      feeInteractedRef.current = true;
      const priority = value as FeePriority;

      // Keep preset tiers unavailable until we have a fetched preset snapshot.
      // Custom remains selectable so users can still set a manual fee.
      if (priority !== FeePriority.CUSTOM && !areFeePresetsLoaded) {
        return;
      }

      // Preset tiers derive their shown value automatically; switching to
      // Custom seeds the editable input with the amount currently shown so it
      // doesn't blank or jump. Persisted on Save (settingSaveCallbacks).
      if (priority === FeePriority.CUSTOM) {
        setCustomFee(localFee);
      }
      setSelectedFeePriority(priority);
    },
    [areFeePresetsLoaded, localFee],
  );

  // Preview the unsaved fee in the breakdown; skip the override while invalid.
  const { openFeeDetails, feeDetailsSheets } = useFeeDetailsBottomSheet({
    isSorobanContext: isSorobanTransaction,
    inclusionFeeXlmOverride: feeError
      ? undefined
      : parseDisplayNumber(localFee).toString(),
  });

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
      saveFeePriorityForContext(selectedFeePriority);
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

    // Dismiss keyboard before onConfirm so any focus side-effects don't reopen it
    Keyboard.dismiss();
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
              {isSorobanTransaction
                ? t("transactionSettings.inclusionFeeTitle")
                : t("transactionSettings.feeTitle")}
            </Text>
            <TouchableOpacity testID="fee-info-button" onPress={openFeeDetails}>
              <Icon.InfoCircle themeColor="gray" size={16} />
            </TouchableOpacity>
          </View>
          <View className="flex flex-row items-center gap-2">
            <NetworkCongestionIndicator level={networkCongestion} size={16} />
            <Text sm secondary>
              {t("transactionSettings.network")}
            </Text>
          </View>
        </View>
        <View className="flex flex-row mt-[4px] items-center gap-2">
          <Input
            fieldSize="lg"
            testID="fee-input"
            value={localFee}
            leftElement={<Icon.Route size={16} themeColor="gray" />}
            onChangeText={handleFeeChange}
            keyboardType="numeric"
            placeholder={formatNumberForDisplay(MIN_TRANSACTION_FEE)}
            error={feeError}
            // Low/Med/High lock the fee to a network preset; only "Custom"
            // allows manual entry.
            editable={selectedFeePriority === FeePriority.CUSTOM}
            rightElement={
              <Text md secondary>
                {NATIVE_TOKEN_CODE}
              </Text>
            }
          />
        </View>
        <View className="mt-[4px]">
          <SegmentedControl
            options={feePriorityOptions}
            selectedValue={selectedFeePriority}
            onValueChange={handleFeePriorityChange}
          />
        </View>
      </View>
    ),
    [
      isSorobanTransaction,
      openFeeDetails,
      localFee,
      feeError,
      t,
      networkCongestion,
      handleFeeChange,
      feePriorityOptions,
      selectedFeePriority,
      handleFeePriorityChange,
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
      {feeDetailsSheets}
    </View>
  );
};

export default TransactionSettingsBottomSheet;
