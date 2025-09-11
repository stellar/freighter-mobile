import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface WelcomeBannerBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onAddXLM: () => void;
  onDismiss: () => void;
}

const CustomContent: React.FC<{
  onAddXLM: () => void;
  onDismiss: () => void;
}> = ({ onAddXLM, onDismiss }) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <View className="size-10 rounded-lg items-center justify-center bg-lilac-3 border border-lilac-6">
          <Icon.Wallet01 themeColor="lilac" />
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          className="size-10 items-center justify-center rounded-full bg-gray-3"
        >
          <Icon.X color={themeColors.gray[9]} />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium>
          {t("welcomeBanner.welcomeMessage")}
        </Text>
        <View className="h-4" />
        <View className="h-px mb-4 bg-border-primary" />
        <View className="mb-5">
          <Text md medium>
            <Text md medium secondary>
              {t("welcomeBanner.fundingText")}
            </Text>
            {t("welcomeBanner.fundingText2")}
          </Text>
        </View>
        <View className="mb-5">
          <Text md medium secondary>
            {t("welcomeBanner.minimumBalanceText")}
          </Text>
        </View>
        <View>
          <Text md medium secondary>
            {t("welcomeBanner.reserveExplanationText")}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Button
          tertiary
          xl
          isFullWidth
          onPress={() => {
            onAddXLM();
            onDismiss();
          }}
        >
          {t("welcomeBanner.addXLM")}
        </Button>
        <Button secondary xl isFullWidth onPress={onDismiss}>
          {t("welcomeBanner.doThisLater")}
        </Button>
      </View>
    </View>
  );
};

const WelcomeBannerBottomSheet: React.FC<WelcomeBannerBottomSheetProps> = ({
  modalRef,
  onAddXLM,
  onDismiss,
}) => (
  <BottomSheet
    modalRef={modalRef}
    handleCloseModal={onDismiss}
    bottomSheetModalProps={{
      onDismiss,
      enableDynamicSizing: true,
    }}
    customContent={<CustomContent onAddXLM={onAddXLM} onDismiss={onDismiss} />}
  />
);

export default WelcomeBannerBottomSheet;
