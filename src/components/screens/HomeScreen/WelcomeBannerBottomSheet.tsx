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
    <View className="gap-6">
      <View className="flex-row justify-between items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{
            backgroundColor: themeColors.gold[3],
            borderWidth: 1,
            borderColor: themeColors.gold[6],
          }}
        >
          <Icon.Wallet01 size={24} themeColor="gold" />
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Icon.X size={24} themeColor="mint" />
        </TouchableOpacity>
      </View>
      <View>
        <Text xl medium className="mb-4">
          {t("welcomeBanner.welcomeMessage")}
        </Text>
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
          lg
          isFullWidth
          onPress={() => {
            onAddXLM();
            onDismiss();
          }}
        >
          {t("welcomeBanner.addXLM")}
        </Button>
        <Button secondary lg isFullWidth onPress={onDismiss}>
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
