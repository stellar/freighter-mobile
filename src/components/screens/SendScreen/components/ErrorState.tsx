import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

const ErrorState: React.FC = () => (
  <View className="flex-1 items-center">
    <Text sm secondary>
      Something went wrong
    </Text>
  </View>
);

export default ErrorState; 