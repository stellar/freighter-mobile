import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import SegmentedControl from "components/sds/SegmentedControl";
import { DEFAULT_SLIPPAGE, MAX_SLIPPAGE, MIN_SLIPPAGE } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface SlippageSettingsProps {
  currentSlippage: number;
  onSave: (slippage: number) => void;
  onGoBack: () => void;
}

const SLIPPAGE_OPTIONS = [
  { label: `${DEFAULT_SLIPPAGE}%`, value: DEFAULT_SLIPPAGE },
  { label: "2%", value: 2 },
  { label: "3%", value: 3 },
];

/**
 * SlippageSettings Component
 *
 * A reusable slippage configuration screen that can be used for swap
 * slippage settings with preset options and custom input.
 * Custom input takes precedence over preset buttons.
 *
 * @param {SlippageSettingsProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const SlippageSettings: React.FC<SlippageSettingsProps> = ({
  currentSlippage,
  onSave,
  onGoBack,
}) => {
  const { t } = useAppTranslation();

  const presetOption = SLIPPAGE_OPTIONS.find(
    (option) => option.value === currentSlippage,
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    presetOption ? presetOption.value : null,
  );

  const [customSlippage, setCustomSlippage] = useState<string>(
    presetOption ? "" : currentSlippage.toString(),
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateCustomSlippage = (value: string): string | null => {
    if (!value || value.trim() === "") {
      return t("slippageScreen.errors.customRequired");
    }

    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) {
      return t("slippageScreen.errors.invalidNumber");
    }

    if (numValue < MIN_SLIPPAGE) {
      return t("slippageScreen.errors.minSlippage", { min: MIN_SLIPPAGE });
    }

    if (numValue > MAX_SLIPPAGE) {
      return t("slippageScreen.errors.maxSlippage", { max: MAX_SLIPPAGE });
    }

    return null;
  };

  const handlePresetSelect = (value: string | number) => {
    setSelectedPreset(Number(value));
    setCustomSlippage("");
    setValidationError(null);
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);

    const numValue = parseFloat(value);
    const matchingPreset = SLIPPAGE_OPTIONS.find(
      (option) => option.value === numValue,
    );

    if (matchingPreset && !Number.isNaN(numValue)) {
      setSelectedPreset(matchingPreset.value);
    } else {
      setSelectedPreset(null);
    }

    if (value) {
      const error = validateCustomSlippage(value);
      setValidationError(error);
    } else {
      setValidationError(null);
    }
  };

  const handleSetDefault = () => {
    setSelectedPreset(DEFAULT_SLIPPAGE);
    setCustomSlippage("");
    setValidationError(null);
  };

  const getCurrentSlippage = (): number => {
    if (customSlippage.trim() !== "") {
      return parseFloat(customSlippage) || 0;
    }

    return selectedPreset || DEFAULT_SLIPPAGE;
  };

  const handleSave = () => {
    const slippageValue = getCurrentSlippage();

    if (customSlippage.trim() !== "") {
      const error = validateCustomSlippage(customSlippage);

      if (error) {
        setValidationError(error);

        return;
      }
    }

    onSave(slippageValue);
    onGoBack();
  };

  const isValidToSave = (): boolean => {
    if (customSlippage.trim() !== "") {
      return !validationError && customSlippage.trim() !== "";
    }

    return selectedPreset !== null;
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View className="gap-6">
          <SegmentedControl
            options={SLIPPAGE_OPTIONS}
            selectedValue={selectedPreset ?? ""}
            onValueChange={handlePresetSelect}
          />

          <TouchableOpacity onPress={() => setSelectedPreset(null)}>
            <Input
              fieldSize="lg"
              value={customSlippage}
              onChangeText={handleCustomSlippageChange}
              keyboardType="numeric"
              placeholder={t("slippageScreen.customPlaceholder")}
              error={validationError}
            />
          </TouchableOpacity>
        </View>

        <View className="gap-3">
          <Button secondary lg onPress={handleSetDefault}>
            {t("slippageScreen.setDefault")}
          </Button>

          <Button tertiary lg onPress={handleSave} disabled={!isValidToSave()}>
            {t("common.done")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default SlippageSettings;
