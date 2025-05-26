/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  BUY_XLM_ROUTES,
  BuyXLMStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";

type BuyXLMScreenProps = NativeStackScreenProps<
  BuyXLMStackParamList,
  typeof BUY_XLM_ROUTES.BUY_XLM_SCREEN
>;

const BuyXLMScreen: React.FC<BuyXLMScreenProps> = ({ navigation, route }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { isUnfunded } = route.params;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors]);

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        title={t("buyXLMScreen.title")}
        description={t("buyXLMScreen.bottomSheet.description")}
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
      />
      <View className="flex-1 items-center mt-5">
        <TouchableOpacity
          className="bg-background-tertiary rounded-2xl p-5 w-full gap-[12px]"
          onPress={() =>
            navigation.navigate(
              ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN,
              {},
            )
          }
        >
          <Icon.QrCode01
            themeColor={isUnfunded ? "lilac" : "mint"}
            size={21.3}
            withBackground
          />
          <View>
            <Text md medium>
              {t("buyXLMScreen.actions.title")}
            </Text>
            <Text sm secondary medium>
              {t("buyXLMScreen.actions.description")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </BaseLayout>
  );
};

export default BuyXLMScreen;
