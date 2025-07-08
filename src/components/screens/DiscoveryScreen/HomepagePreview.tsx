import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

const HomepagePreview: React.FC = () => {
  const { themeColors } = useColors();

  return (
    <View className="w-full h-full bg-background-primary justify-center items-center">
      <Icon.Home01 size={32} color={themeColors.text.primary} />
      <Text sm semiBold className="text-text-primary mt-2">
        Home
      </Text>
    </View>
  );
};

export default HomepagePreview;
