import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

interface RefreshCardProps {
  title: string;
  onRefresh: () => void;
  actionTitle: string;
  loadingTitle: string;
  isLoading?: boolean;
}

/**
 * Generic component for displaying a message with a refresh button
 */
const RefreshCard: React.FC<RefreshCardProps> = ({
  title,
  onRefresh,
  actionTitle,
  loadingTitle,
  isLoading = false,
}) => (
  <View className="rounded-2xl py-6 px-4 bg-gray-3 w-full">
    <View className="flex-col items-center">
      <Text md secondary weight="medium">
        {title}
      </Text>
      <TextButton
        text={isLoading ? loadingTitle : actionTitle}
        variant="tertiary"
        weight="medium"
        onPress={onRefresh}
        className="mt-2"
        isLoading={isLoading}
      />
    </View>
  </View>
);

export default RefreshCard;
