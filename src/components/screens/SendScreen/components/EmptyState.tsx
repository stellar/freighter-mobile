import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

const EmptyState: React.FC = () => {
  return (
    <View className="flex-1 justify-center items-center">
      <Text sm secondary>
        No contacts found
      </Text>
    </View>
  );
};

export default EmptyState; 