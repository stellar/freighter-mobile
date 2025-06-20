import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { DEFAULT_TRANSACTION_TIMEOUT } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

interface TimeoutSettingsProps {
  currentTimeout: number;
  onSave: (timeout: number) => void;
  onGoBack: () => void;
}

/**
 * TimeoutSettings Component
 *
 * A reusable timeout configuration screen that can be used for both
 * transaction and swap timeout settings.
 *
 * @param {TimeoutSettingsProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const TimeoutSettings: React.FC<TimeoutSettingsProps> = ({
  currentTimeout,
  onSave,
  onGoBack,
}) => {
  const { t } = useAppTranslation();
  const [localTimeout, setLocalTimeout] = useState(currentTimeout.toString());
  const { error } = useValidateTransactionTimeout(localTimeout);

  useEffect(() => {
    setLocalTimeout(currentTimeout.toString());
  }, [currentTimeout]);

  const handleSave = () => {
    if (error) return;

    const timeoutValue = Number(localTimeout);
    onSave(timeoutValue);
    onGoBack();
  };

  const handleSetRecommended = () => {
    setLocalTimeout(DEFAULT_TRANSACTION_TIMEOUT.toString());
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View className="flex-col gap-2">
          <Input
            fieldSize="lg"
            value={localTimeout}
            onChangeText={setLocalTimeout}
            keyboardType="numeric"
            placeholder={t("transactionTimeoutScreen.inputPlaceholder")}
            rightElement={
              <Text md secondary>
                {t("transactionTimeoutScreen.seconds")}
              </Text>
            }
            error={error}
          />
        </View>
        <View className="gap-4 mb-4">
          <Button secondary lg onPress={handleSetRecommended}>
            {t("transactionTimeoutScreen.setRecommended")}
          </Button>
          <Button
            tertiary
            lg
            onPress={handleSave}
            disabled={!!error || !localTimeout}
          >
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TimeoutSettings;
