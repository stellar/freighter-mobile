/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { TokenSelectionContent } from "components/screens/SwapScreen/components";
import Icon from "components/sds/Icon";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect } from "react";
import { TouchableOpacity } from "react-native";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors]);

  const handleTokenPress = (tokenId: string, tokenSymbol: string) => {
    navigation.navigate(SWAP_ROUTES.SWAP_AMOUNT_SCREEN, {
      tokenId,
      tokenSymbol,
    });
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <TokenSelectionContent
        onTokenPress={handleTokenPress}
        customTitle={t("swapScreen.swapScreenTokenListTitle")}
      />
    </BaseLayout>
  );
};

export default SwapScreen;
