import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity } from "react-native";

const LINE_CLASS = "flex-row items-center justify-center gap-[6px]";

interface SwapQuoteLineProps {
  onPress: () => void;
  /** Ignores presses, e.g. while Review is being built. */
  disabled?: boolean;
  /** Spacing around the line; main Swap's screen sets a top margin. */
  className?: string;
  testID?: string;
}

/**
 * Under the receive card once the quote answers the current inputs: the
 * network fee, and "See details" for the fee, rate and route.
 */
export const SwapSeeDetailsLine: React.FC<
  SwapQuoteLineProps & {
    /** e.g. "$0.22", or "0.00001 XLM" when the fiat would round to $0.00. */
    networkFee: string;
  }
> = ({
  networkFee,
  onPress,
  disabled,
  className = "",
  testID = "swap-see-details",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className={`${LINE_CLASS} ${className}`}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
    >
      <Text sm secondary>
        {t("swapScreen.details.networkFeeLine", { fee: networkFee })}
      </Text>
      <Text sm secondary>
        ·
      </Text>
      <Text sm secondary>
        {t("swapScreen.details.seeDetails")}
      </Text>
      <Icon.InfoCircle size={14} color={themeColors.text.secondary} />
    </TouchableOpacity>
  );
};

/** Under the receive card when the quote for the current inputs failed. */
export const SwapQuoteUnavailableLine: React.FC<SwapQuoteLineProps> = ({
  onPress,
  disabled,
  className = "",
  testID = "swap-quote-unavailable",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <TouchableOpacity
      className={`${LINE_CLASS} ${className}`}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
    >
      <Text sm secondary>
        {t("swapScreen.quoteUnavailable.title")}
      </Text>
      <Icon.InfoCircle size={14} color={themeColors.text.secondary} />
    </TouchableOpacity>
  );
};
