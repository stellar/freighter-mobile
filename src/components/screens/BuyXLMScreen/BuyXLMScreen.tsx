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
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useRef } from "react";
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

  useRightHeaderButton({
    onPress: () => bottomSheetModalRef.current?.present(),
  });

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        customContent={
          <View className="gap-4">
            <View className="flex-row justify-between items-center">
              <View className="size-10 rounded-lg items-center justify-center bg-lilac-3 border border-lilac-6">
                <Icon.Plus themeColor="lilac" />
              </View>
              <TouchableOpacity
                onPress={() => bottomSheetModalRef.current?.dismiss()}
                className="size-10 items-center justify-center rounded-full bg-gray-3"
              >
                <Icon.X color={themeColors.gray[9]} />
              </TouchableOpacity>
            </View>
            <View>
              <Text xl medium>
                {t("buyXLMScreen.title")}
              </Text>
              <View className="h-4" />
              <Text md medium secondary>
                {t("buyXLMScreen.bottomSheet.description")}
              </Text>
              <View className="h-4" />
              <Text md medium secondary>
                {t("buyXLMScreen.bottomSheet.subDescription")}
              </Text>
            </View>
          </View>
        }
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
            size={21.3}
            circle
            circleBackground={
              isUnfunded ? themeColors.lilac[3] : themeColors.mint[3]
            }
            circleBorder={
              isUnfunded ? themeColors.lilac[6] : themeColors.mint[6]
            }
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
