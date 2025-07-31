import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React from "react";
import { View } from "react-native";

type ScanQRCodeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN
>;

const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();

  useRightHeaderButton({
    onPress: () =>
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN, {
        showNavigationAsCloseButton: true,
      }),
    icon: Icon.QrCode01,
  });

  return (
    <BaseLayout>
      <View className="flex-1 items-center justify-center">
        <Text md primary medium>
          {t("scanQRCodeScreen.scanWCQrCode")}
        </Text>
      </View>
    </BaseLayout>
  );
};

export default ScanQRCodeScreen;
