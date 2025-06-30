import Icon from "components/sds/Icon";
import { Display } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

interface NumericKeyboardProps {
  onPress: (value: string) => void;
}

const NumericKeyboard: React.FC<NumericKeyboardProps> = ({ onPress }) => {
  const { themeColors } = useColors();

  const renderButton = (content: string | React.ReactNode) => (
    <View className="flex-1">
      <View
        className="h-[48px] max-xs:h-[32px] items-center justify-center rounded-[12px]"
        onTouchEnd={() => onPress(typeof content === "string" ? content : "")}
      >
        {typeof content === "string" ? (
          <Display xs medium>
            {content}
          </Display>
        ) : (
          content
        )}
      </View>
    </View>
  );

  return (
    <View className="gap-[12px] max-xs:gap-[4px]">
      <View className="flex-row gap-[12px] max-xs:gap-[4px]">
        {renderButton("1")}
        {renderButton("2")}
        {renderButton("3")}
      </View>
      <View className="flex-row gap-[12px] max-xs:gap-[4px]">
        {renderButton("4")}
        {renderButton("5")}
        {renderButton("6")}
      </View>
      <View className="flex-row gap-[12px] max-xs:gap-[4px]">
        {renderButton("7")}
        {renderButton("8")}
        {renderButton("9")}
      </View>
      <View className="flex-row gap-[12px] max-xs:gap-[4px]">
        {renderButton(".")}
        {renderButton("0")}
        {renderButton(
          <Icon.Delete size={32} color={themeColors.text.primary} />,
        )}
      </View>
    </View>
  );
};

export default NumericKeyboard;
