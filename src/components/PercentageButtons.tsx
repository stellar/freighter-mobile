import { Button } from "components/sds/Button";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

/** The shortcuts a row can offer; 100 is labelled "Max". */
export type PercentageOption = 25 | 50 | 75 | 100;

const DEFAULT_PERCENTAGES: PercentageOption[] = [25, 50, 75, 100];

export interface PercentageButtonsProps {
  /** Called with the percentage value (25, 50, 75, or 100). */
  onPress: (percentage: number) => void;
  /**
   * Which shortcuts to show, in order. Defaults to 25% / 50% / 75% / Max;
   * Earn's deposit and swap sheets show 25% / 50% / Max.
   */
  percentages?: PercentageOption[];
  /** Test ID for the row container (optional). */
  testID?: string;
}

/**
 * Row of amount-shortcut buttons (25% / 50% / 75% / Max by default).
 *
 * Stretches to its parent's width — wrap it with `items-center` and whatever
 * vertical margin the screen wants.
 */
export const PercentageButtons: React.FC<PercentageButtonsProps> = ({
  onPress,
  percentages = DEFAULT_PERCENTAGES,
  testID,
}) => {
  const { t } = useAppTranslation();
  const labels: Record<PercentageOption, string> = {
    25: t("transactionAmountScreen.percentageButtons.twentyFive"),
    50: t("transactionAmountScreen.percentageButtons.fifty"),
    75: t("transactionAmountScreen.percentageButtons.seventyFive"),
    100: t("transactionAmountScreen.percentageButtons.max"),
  };

  return (
    <View testID={testID} className="flex-row gap-[8px] w-full">
      {percentages.map((value) => (
        <View key={value} className="flex-1">
          <Button
            tertiary
            xl
            onPress={() => onPress(value)}
            testID={`percentage-${value}`}
          >
            {labels[value]}
          </Button>
        </View>
      ))}
    </View>
  );
};

export default PercentageButtons;
