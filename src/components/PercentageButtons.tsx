import { Button } from "components/sds/Button";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export interface PercentageButtonsProps {
  /** Called with the percentage value (25, 50, 75, or 100). */
  onPress: (percentage: number) => void;
  /** Test ID for the row container (optional). */
  testID?: string;
}

/**
 * Row of four amount-shortcut buttons (25% / 50% / 75% / Max) shared between
 * the Send and Swap amount screens.
 *
 * The row stretches to its parent's width — wrap it with `items-center` and
 * whatever vertical margin the screen wants. Uses the `lg` button size that
 * the Swap flow standardised on (the previous Send variant used `xl`).
 */
export const PercentageButtons: React.FC<PercentageButtonsProps> = ({
  onPress,
  testID,
}) => {
  const { t } = useAppTranslation();
  const items = [
    {
      value: 25,
      label: t("transactionAmountScreen.percentageButtons.twentyFive"),
    },
    { value: 50, label: t("transactionAmountScreen.percentageButtons.fifty") },
    {
      value: 75,
      label: t("transactionAmountScreen.percentageButtons.seventyFive"),
    },
    { value: 100, label: t("transactionAmountScreen.percentageButtons.max") },
  ];
  return (
    <View testID={testID} className="flex-row gap-[8px] w-full">
      {items.map(({ value, label }) => (
        <View key={value} className="flex-1">
          <Button
            secondary
            lg
            onPress={() => onPress(value)}
            testID={`percentage-${value}`}
          >
            {label}
          </Button>
        </View>
      ))}
    </View>
  );
};

export default PercentageButtons;
