import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface HistoryWrapperProps {
  text?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
  refreshFunction?: () => void;
}

/**
 * Shared wrapper component for history-related screens to display empty, error, or loading states
 */
const HistoryWrapper: React.FC<HistoryWrapperProps> = ({
  text,
  children,
  isLoading,
  refreshFunction,
}) => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout insets={{ bottom: false }}>
      <View className="flex-1 items-center justify-center px-2 gap-4">
        {children}
        {text && (
          <Text lg primary semiBold>
            {text}
          </Text>
        )}
        {refreshFunction && (
          <Button primary xl isLoading={isLoading} onPress={refreshFunction}>
            {isLoading ? t("history.refreshing") : t("history.refresh")}
          </Button>
        )}
      </View>
    </BaseLayout>
  );
};

export default HistoryWrapper;
