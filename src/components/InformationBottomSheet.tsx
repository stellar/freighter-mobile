import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";

type InformationBottomSheetProps = {
  onConfirm?: () => void;
  onClose: () => void;
  title: string;
  headerElement?: React.ReactNode;
  texts: string[];
};

const InformationBottomSheet = ({
  onConfirm,
  onClose,
  title,
  headerElement,
  texts,
}: InformationBottomSheetProps) => {
  const { themeColors } = useColors();

  const { t } = useTranslation();

  return (
    <View className="flex-1">
      <View className="relative flex-row items-center mb-8">
        {headerElement}
        <TouchableOpacity onPress={onClose} className="absolute right-0">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={24}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium primary textAlign="left">
          {title}
        </Text>
      </View>
      {texts.map((text) => (
        <View className="mt-[24px] pr-8" key={text}>
          <Text md medium secondary textAlign="left">
            {text}
          </Text>
        </View>
      ))}
      {onConfirm && (
        <View className="mt-[24px] gap-[12px] flex-row">
          <View className="flex-1">
            <Button onPress={onConfirm} tertiary xl>
              {t("common.addMemo")}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default InformationBottomSheet;
