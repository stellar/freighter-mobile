import { TokenIcon } from "components/TokenIcon";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { PricedBalance } from "config/types";
import { fsValue, pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React from "react";
import { Keyboard, TextInput, TouchableOpacity, View } from "react-native";

const AVAILABLE_BALANCE_FONT_SIZES = [
  { maxLen: 28, size: fsValue(16) },
  { maxLen: 42, size: fsValue(14) },
  { maxLen: Infinity, size: fsValue(12) },
] as const;

const getAvailableBalanceFontSize = (text: string | null | undefined): number =>
  AVAILABLE_BALANCE_FONT_SIZES.find(
    ({ maxLen }) => (text?.length ?? 0) <= maxLen,
  )!.size;

// Dynamic amount font: shrink as the displayed amount string grows so that
// very long numbers don't overflow the row. Mirrors the sizing curve Send
// used before extraction.
const getAmountFontSize = (textLength: number): number => {
  if (textLength <= 9) return fsValue(32);
  if (textLength <= 15) return fsValue(24);
  return fsValue(18);
};

type AmountCardCommonProps = {
  label: string;
  /** Token used to render the icon inside the picker chip. */
  selectedToken?: PricedBalance;
  /** Override for the picker chip's text label (e.g. "Select token" when no
   *  token is selected). Defaults to selectedToken?.tokenCode. */
  pickerLabel?: string;
  onPickerPress: () => void;
  pickerTestID?: string;
  testID?: string;
  /** Shown on the right of the label row. Hidden when null/undefined. */
  availableBalanceText?: string | null;
};

type AmountCardEditableProps = AmountCardCommonProps & {
  // Discriminator for the public union; consumed by the AmountCard wrapper to
  // pick which child renderer runs. Not read inside EditableAmountCard.
  // eslint-disable-next-line react/no-unused-prop-types
  mode: "editable";
  converter: UseTokenFiatConverterResult;
  /** Optional text rendered on the secondary line next to the $↔token toggle.
   *  Caller-supplied so the component stays formatting-agnostic. */
  secondaryAmountText?: string;
  /** When false, the secondary line + $↔token toggle are hidden. */
  hasUsdPrice: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  inputTestID?: string;
  focusTriggerTestID?: string;
  fiatToggleTestID?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type AmountCardReadOnlyProps = AmountCardCommonProps & {
  // Discriminator for the public union; consumed by the AmountCard wrapper.
  // eslint-disable-next-line react/no-unused-prop-types
  mode: "readonly";
  /** Big text shown in place of the input. */
  primaryAmount: string;
  /** Optional small text below the big amount. */
  secondaryAmount?: string;
  /** When true, render primaryAmount in the secondary text color (placeholder
   *  state — e.g. "0" before a destination is picked). */
  placeholderActive?: boolean;
};

export type AmountCardProps = AmountCardEditableProps | AmountCardReadOnlyProps;

const CardShell: React.FC<{
  testID?: string;
  children: React.ReactNode;
}> = ({ testID, children }) => (
  <View
    testID={testID}
    className="rounded-[12px] gap-[12px] py-[12px] max-xs:py-[8px] px-[16px] max-xs:px-[12px] bg-background-tertiary w-full pt-5 pb-4"
  >
    {children}
  </View>
);

const HeaderRow: React.FC<{
  label: string;
  availableBalanceText?: string | null;
}> = ({ label, availableBalanceText }) => (
  <View className="flex-row items-end justify-between">
    <Text md secondary style={{ lineHeight: pxValue(16) }}>
      {label}
    </Text>
    {!!availableBalanceText && (
      <Text
        medium
        secondary
        numberOfLines={1}
        textAlign="right"
        style={{
          fontSize: getAvailableBalanceFontSize(availableBalanceText),
          lineHeight: getAvailableBalanceFontSize(availableBalanceText),
          flexShrink: 1,
          marginLeft: pxValue(8),
          marginRight: pxValue(4),
        }}
      >
        {availableBalanceText}
      </Text>
    )}
  </View>
);

const PickerChip: React.FC<{
  token?: PricedBalance;
  label?: string;
  onPress: () => void;
  testID?: string;
}> = ({ token, label, onPress, testID }) => {
  const { themeColors } = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-[6px] ml-[12px] rounded-full bg-background-primary px-[12px] py-[8px]"
      testID={testID}
    >
      {token && <TokenIcon token={token} size="md" />}
      <Text md medium>
        {label ?? token?.tokenCode ?? ""}
      </Text>
      <Icon.ChevronDown size={18} color={themeColors.text.primary} />
    </TouchableOpacity>
  );
};

const EditableAmountCard: React.FC<AmountCardEditableProps> = ({
  label,
  selectedToken,
  pickerLabel,
  onPickerPress,
  pickerTestID,
  testID,
  availableBalanceText,
  converter,
  secondaryAmountText,
  hasUsdPrice,
  inputRef,
  inputTestID,
  focusTriggerTestID,
  fiatToggleTestID,
  autoFocus,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { themeColors } = useColors();

  // Empty when the underlying token amount is 0 AND the user has no active
  // raw input beyond plain "0". This lets partial inputs like "0," or "0,2"
  // show the typed value while still hiding it for the initial/reset state.
  const rawIsEmpty = converter.showFiatAmount
    ? converter.fiatAmountDisplayRaw === null ||
      converter.fiatAmountDisplayRaw === "0"
    : converter.tokenAmountDisplayRaw === null ||
      converter.tokenAmountDisplayRaw === "0";
  const isEmpty = converter.tokenAmount === "0" && rawIsEmpty;

  const primaryText = converter.showFiatAmount
    ? (converter.fiatAmountDisplayRaw ?? converter.fiatAmountDisplay)
    : (converter.tokenAmountDisplayRaw ?? converter.tokenAmountDisplay);

  const amountFontSize = getAmountFontSize(primaryText.length);
  const resolvedPickerLabel = pickerLabel ?? selectedToken?.tokenCode;

  const focusInput = () => inputRef?.current?.focus();

  return (
    <CardShell testID={testID}>
      <HeaderRow label={label} availableBalanceText={availableBalanceText} />

      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          className="flex-1"
          onPressIn={focusInput}
          activeOpacity={1}
          accessible={false}
          testID={focusTriggerTestID}
        >
          <View className="flex-row items-center">
            {converter.showFiatAmount && (
              <Display
                style={{
                  fontSize: amountFontSize,
                  fontWeight: "500",
                  color: isEmpty
                    ? themeColors.text.secondary
                    : themeColors.text.primary,
                }}
              >
                $
              </Display>
            )}
            <TextInput
              ref={inputRef}
              testID={inputTestID}
              accessibilityLabel={accessibilityLabel}
              accessibilityHint={accessibilityHint}
              keyboardType="decimal-pad"
              showSoftInputOnFocus
              autoFocus={autoFocus}
              value={isEmpty ? "" : primaryText}
              placeholder="0"
              placeholderTextColor={themeColors.text.secondary}
              onChangeText={converter.setDisplayAmountFromText}
              onSubmitEditing={() => Keyboard.dismiss()}
              underlineColorAndroid="transparent"
              style={{
                flex: 1,
                fontSize: amountFontSize,
                fontWeight: "500",
                color: themeColors.text.primary,
                padding: 0,
                includeFontPadding: false,
              }}
            />
          </View>
        </TouchableOpacity>

        <PickerChip
          token={selectedToken}
          label={resolvedPickerLabel}
          onPress={onPickerPress}
          testID={pickerTestID}
        />
      </View>

      {hasUsdPrice && (
        <View className="flex-row items-center gap-[4px] mb-1">
          <Text sm medium secondary numberOfLines={1} style={{ flexShrink: 1 }}>
            {secondaryAmountText ?? ""}
          </Text>
          <TouchableOpacity
            hitSlop={10}
            onPress={() =>
              converter.setShowFiatAmount(!converter.showFiatAmount)
            }
            testID={fiatToggleTestID}
          >
            <Icon.RefreshCcw03 size={14} color={themeColors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </CardShell>
  );
};

const ReadOnlyAmountCard: React.FC<AmountCardReadOnlyProps> = ({
  label,
  selectedToken,
  pickerLabel,
  onPickerPress,
  pickerTestID,
  testID,
  availableBalanceText,
  primaryAmount,
  secondaryAmount,
  placeholderActive,
}) => {
  const { themeColors } = useColors();
  const amountFontSize = getAmountFontSize(primaryAmount.length);
  const resolvedPickerLabel = pickerLabel ?? selectedToken?.tokenCode;

  return (
    <CardShell testID={testID}>
      <HeaderRow label={label} availableBalanceText={availableBalanceText} />

      <View className="flex-row items-center justify-between">
        <Display
          style={{
            flex: 1,
            fontSize: amountFontSize,
            fontWeight: "500",
            color: placeholderActive
              ? themeColors.text.secondary
              : themeColors.text.primary,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {primaryAmount}
        </Display>

        <PickerChip
          token={selectedToken}
          label={resolvedPickerLabel}
          onPress={onPickerPress}
          testID={pickerTestID}
        />
      </View>

      {!!secondaryAmount && (
        <View className="flex-row items-center mb-1">
          <Text sm medium secondary numberOfLines={1} style={{ flexShrink: 1 }}>
            {secondaryAmount}
          </Text>
        </View>
      )}
    </CardShell>
  );
};

export const AmountCard: React.FC<AmountCardProps> = (props) => {
  // Destructuring the discriminator loses TS narrowing for the rest of props,
  // so we read it off `props` directly and disable the rule for this access.
  // eslint-disable-next-line react/destructuring-assignment
  if (props.mode === "editable") {
    return <EditableAmountCard {...props} />;
  }
  return <ReadOnlyAmountCard {...props} />;
};

export default AmountCard;
