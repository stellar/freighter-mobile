import BigNumber from "bignumber.js";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { Balance, PricedBalance, Token } from "config/types";
import { fsValue, pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Keyboard,
  Platform,
  // Raw RN Text used for the editable "$" prefix so it renders through the
  // same native primitive as the adjacent TextInput — picking up the same
  // baseline metrics. The styled-component `<Display>` (used elsewhere) has
  // subtly different vertical metrics that drifted the "$" off the digits.
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SecurityLevel } from "services/blockaid/constants";

// SDS Display uses `Inter-Variable` (iOS) / `Inter-Medium` (Android). A
// plain RN TextInput falls back to the system font (SF Pro / Roboto), which
// has different vertical metrics than Inter — so the "$" prefix Display sat
// below the digits' baseline. Forcing the same fontFamily on the TextInput
// lines them up.
const AMOUNT_FONT_FAMILY = Platform.select({
  ios: "Inter-Variable",
  android: "Inter-Medium",
});

// Balance text size curve. Common case is 14/20 (Text sm); longer-string
// branches keep the lineHeight at 20 (see HeaderRow) and shrink the font so
// the line still fits the 20px band on narrow widths.
const AVAILABLE_BALANCE_FONT_SIZES = [
  { maxLen: 28, size: fsValue(14) },
  { maxLen: 42, size: fsValue(12) },
  { maxLen: Infinity, size: fsValue(10) },
] as const;

const getAvailableBalanceFontSize = (text: string | null | undefined): number =>
  AVAILABLE_BALANCE_FONT_SIZES.find(
    ({ maxLen }) => (text?.length ?? 0) <= maxLen,
  )!.size;

// Dynamic amount font: shrink as the displayed amount string grows so that
// very long numbers don't overflow the row. Common case is 24/32; long-amount
// branches step down to keep the row in its 32px band.
const getAmountFontSize = (textLength: number): number => {
  if (textLength <= 9) return fsValue(24);
  if (textLength <= 15) return fsValue(20);
  return fsValue(16);
};

// Amount letter-spacing: -0.04em on a 24px font → -0.96px.
const AMOUNT_LETTER_SPACING = -0.96;
// Amount row line-height matches the row band (no extra vertical padding
// around the digits).
const AMOUNT_LINE_HEIGHT = 32;

type AmountCardCommonProps = {
  label: string;
  /** Token used to render the icon inside the picker chip. Accepts a held
   *  PricedBalance / Balance or a non-held Token descriptor so the same
   *  chip works on Swap-Receive where the destination has no trustline yet. */
  selectedToken?: PricedBalance | Balance | Token;
  /** Override for the picker chip's text label (e.g. "Select token" when no
   *  token is selected). Defaults to selectedToken.tokenCode when present. */
  pickerLabel?: string;
  /** Optional Blockaid security level. When set to anything other than SAFE
   *  / UNABLE_TO_SCAN, the picker chip's token icon renders with a warning
   *  badge overlay. */
  pickerSecurityLevel?: SecurityLevel;
  /** Optional explicit icon URL for the picker chip. Forwarded to
   *  `TokenIconWithBadge` as a third-priority fallback (after the
   *  `useTokenIconsStore` cache lookup). Useful for non-held destinations
   *  selected from a stellar.expert search row whose `tomlInfo.image` URL
   *  was already known at selection time — without this the chip would fall
   *  back to a 2-letter avatar until the trustline is added. */
  pickerIconUrl?: string;
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
  // 12px symmetric vertical padding, collapsing to 8px on xs screens.
  <View
    testID={testID}
    className="rounded-[12px] gap-[12px] py-[12px] max-xs:py-[8px] px-[16px] max-xs:px-[12px] bg-background-tertiary w-full"
  >
    {children}
  </View>
);

const HeaderRow: React.FC<{
  label: string;
  availableBalanceText?: string | null;
}> = ({ label, availableBalanceText }) => (
  <View className="flex-row items-center justify-between gap-[12px]">
    <Text sm medium secondary style={{ lineHeight: pxValue(20) }}>
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
          // Balance line stays in a 20px band regardless of how small the font
          // has to shrink — line-height is fixed, font-size is the only thing
          // that scales.
          lineHeight: pxValue(20),
          flexShrink: 1,
        }}
      >
        {availableBalanceText}
      </Text>
    )}
  </View>
);

const PickerChip: React.FC<{
  token?: PricedBalance | Balance | Token;
  label?: string;
  securityLevel?: SecurityLevel;
  iconUrl?: string;
  onPress: () => void;
  testID?: string;
}> = ({ token, label, securityLevel, iconUrl, onPress, testID }) => {
  const { themeColors } = useColors();
  // PricedBalance / Balance carry `tokenCode`; bare `Token` carries `code`.
  // Fall back to whichever exists so non-held descriptors still get a label.
  let fallbackLabel: string | undefined;
  if (token && "tokenCode" in token) {
    fallbackLabel = token.tokenCode;
  } else if (token && "code" in token) {
    fallbackLabel = token.code;
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-[4px] rounded-full bg-background-secondary px-[10px] py-[8px]"
      testID={testID}
    >
      {token ? (
        // size="md" (24×24) — the 16px Blockaid badge overlay is sized
        // proportionally to this larger icon; with size="sm" (16×16) the
        // badge nearly covers the whole icon. Chip height stays 32px
        // because the `<Text md>` lineHeight (24) already dominates the
        // row.
        <TokenIconWithBadge
          token={token}
          size="md"
          securityLevel={securityLevel}
          iconUrl={iconUrl}
        />
      ) : (
        // Empty-state affordance: a Plus-in-circle to signal "tap to add a
        // token" when no token has been picked yet.
        <View className="w-[20px] h-[20px] rounded-full items-center justify-center bg-gray-3">
          <Icon.Plus size={16} themeColor="gray" />
        </View>
      )}
      <Text md medium>
        {label ?? fallbackLabel ?? ""}
      </Text>
      <Icon.ChevronDown size={16} color={themeColors.text.primary} />
    </TouchableOpacity>
  );
};

const EditableAmountCard: React.FC<AmountCardEditableProps> = ({
  label,
  selectedToken,
  pickerLabel,
  pickerSecurityLevel,
  pickerIconUrl,
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

  // Empty when the underlying token amount is 0 AND the user hasn't actively
  // typed anything (raw display === null). A raw display of "0" means the
  // user typed a literal "0" — we keep that visible so the next keystroke
  // (e.g. ".") appends to it instead of replacing it.
  const rawIsEmpty = converter.showFiatAmount
    ? converter.fiatAmountDisplayRaw === null
    : converter.tokenAmountDisplayRaw === null;
  // BigNumber comparison (vs string === "0") so programmatic setTokenAmount
  // calls that pass non-canonical zeros like "0.0000000" (e.g. percentage
  // buttons with a zero spendable balance) still route to the placeholder.
  const tokenAmountIsZero = new BigNumber(
    converter.tokenAmount,
  ).isLessThanOrEqualTo(0);
  const isEmpty = tokenAmountIsZero && rawIsEmpty;

  const primaryText = converter.showFiatAmount
    ? (converter.fiatAmountDisplayRaw ?? converter.fiatAmountDisplay)
    : (converter.tokenAmountDisplayRaw ?? converter.tokenAmountDisplay);

  const amountFontSize = getAmountFontSize(primaryText.length);
  // PickerChip resolves its own fallback when pickerLabel is undefined.

  // iOS focus-retry workaround: focus() can silently drop when the input is
  // hidden/animated; re-attempt on the next tick if isFocused() is still
  // false.
  const focusRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(
    () => () => {
      if (focusRetryTimeoutRef.current) {
        clearTimeout(focusRetryTimeoutRef.current);
      }
    },
    [],
  );
  const focusInput = useCallback(() => {
    inputRef?.current?.focus();
    if (focusRetryTimeoutRef.current) {
      clearTimeout(focusRetryTimeoutRef.current);
    }
    focusRetryTimeoutRef.current = setTimeout(() => {
      if (!inputRef?.current?.isFocused()) {
        inputRef?.current?.focus();
      }
    }, 0);
  }, [inputRef]);

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
              <RNText
                style={{
                  // Match the TextInput style exactly. lineHeight and
                  // textAlignVertical are intentionally omitted — RN
                  // TextInput's placeholder uses different metrics than its
                  // value when lineHeight is explicit, causing a few-pixel
                  // vertical jump when the user starts typing; aligning by
                  // natural metrics (no lineHeight) keeps both states stable
                  // and the "$" baseline pinned to the digits.
                  fontFamily: AMOUNT_FONT_FAMILY,
                  fontSize: amountFontSize,
                  letterSpacing: AMOUNT_LETTER_SPACING,
                  fontWeight: "500",
                  color: isEmpty
                    ? themeColors.text.secondary
                    : themeColors.text.primary,
                  padding: 0,
                  includeFontPadding: false,
                }}
              >
                $
              </RNText>
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
                fontFamily: AMOUNT_FONT_FAMILY,
                fontSize: amountFontSize,
                letterSpacing: AMOUNT_LETTER_SPACING,
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
          label={pickerLabel}
          securityLevel={pickerSecurityLevel}
          iconUrl={pickerIconUrl}
          onPress={onPickerPress}
          testID={pickerTestID}
        />
      </View>

      {hasUsdPrice && (
        <View className="flex-row items-center gap-[4px]">
          <Text
            sm
            medium
            secondary
            numberOfLines={1}
            style={{ flexShrink: 1, lineHeight: pxValue(20) }}
          >
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
  pickerSecurityLevel,
  pickerIconUrl,
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
  // PickerChip resolves its own fallback when pickerLabel is undefined.

  return (
    <CardShell testID={testID}>
      <HeaderRow label={label} availableBalanceText={availableBalanceText} />

      <View className="flex-row items-center justify-between">
        <Display
          style={{
            flex: 1,
            fontSize: amountFontSize,
            lineHeight: pxValue(AMOUNT_LINE_HEIGHT),
            letterSpacing: AMOUNT_LETTER_SPACING,
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
          label={pickerLabel}
          securityLevel={pickerSecurityLevel}
          iconUrl={pickerIconUrl}
          onPress={onPickerPress}
          testID={pickerTestID}
        />
      </View>

      {!!secondaryAmount && (
        <View className="flex-row items-center">
          <Text
            sm
            medium
            secondary
            numberOfLines={1}
            style={{ flexShrink: 1, lineHeight: pxValue(20) }}
          >
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
