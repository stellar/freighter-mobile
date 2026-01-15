import RefreshCard from "components/RefreshCard";
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

  const renderContent = () => {
    if (text && refreshFunction) {
      return (
        <RefreshCard
          title={text}
          onRefresh={refreshFunction}
          actionTitle={t("history.refresh")}
          loadingTitle={t("history.refreshing")}
          isLoading={isLoading}
        />
      );
    }

    if (text) {
      return (
        <Text lg primary semiBold>
          {text}
        </Text>
      );
    }

    return null;
  };

  return (
    <View className="flex-1 items-center justify-center px-2 gap-4">
      {children}
      {renderContent()}
    </View>
  );
};

export default HistoryWrapper;
