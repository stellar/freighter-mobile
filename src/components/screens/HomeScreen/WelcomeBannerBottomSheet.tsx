import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { colors } from "config/colors";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors, { ThemeColors } from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import styled from "styled-components/native";

const WalletIconContainer = styled.View`
  width: ${px(40)};
  height: ${px(40)};
  border-radius: ${px(20)};
  background-color: ${colors.dark.gold[3]};
  border: 1px solid ${colors.dark.gold[6]};
  align-items: center;
  justify-content: center;
`;

const TextBlock = styled.View`
  margin-bottom: ${px(20)};
`;

const Separator = styled.View`
  height: 1px;
  background-color: ${THEME.colors.border.default};
  margin-bottom: ${px(16)};
`;

const ContentContainer = styled.View`
  gap: ${px(24)};
`;

const HeaderContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const TextContainer = styled.View``;

const ButtonContainer = styled.View`
  gap: ${px(12)};
`;

interface WelcomeBannerBottomSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  onAddXLM: () => void;
  onDismiss: () => void;
}

interface CustomContentProps {
  onAddXLM: () => void;
  onDismiss: () => void;
  t: (key: string) => string;
  themeColors: ThemeColors;
}

const CustomContent: React.FC<CustomContentProps> = ({
  onAddXLM,
  onDismiss,
  t,
  themeColors,
}) => (
  <ContentContainer>
    <HeaderContainer>
      <WalletIconContainer>
        <Icon.Wallet01 size={28} themeColor="gold" />
      </WalletIconContainer>
      <TouchableOpacity onPress={onDismiss}>
        <Icon.X size={24} color={themeColors.base[1]} />
      </TouchableOpacity>
    </HeaderContainer>
    <TextContainer>
      <Text
        xl
        medium
        color={THEME.colors.text.primary}
        style={{ marginBottom: 16 }}
      >
        {t("welcomeBanner.welcomeMessage")}
      </Text>
      <Separator />
      <TextBlock>
        <Text md medium color={THEME.colors.text.secondary}>
          {t("welcomeBanner.fundingText")}
        </Text>
      </TextBlock>
      <TextBlock>
        <Text md medium color={THEME.colors.text.secondary}>
          {t("welcomeBanner.minimumBalanceText")}
        </Text>
      </TextBlock>
      <View>
        <Text md medium color={THEME.colors.text.secondary}>
          {t("welcomeBanner.reserveExplanationText")}
        </Text>
      </View>
    </TextContainer>
    <ButtonContainer>
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
    </ButtonContainer>
  </ContentContainer>
);

const WelcomeBannerBottomSheet: React.FC<WelcomeBannerBottomSheetProps> = ({
  modalRef,
  onAddXLM,
  onDismiss,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <BottomSheet
      modalRef={modalRef}
      handleCloseModal={onDismiss}
      customContent={
        <CustomContent
          onAddXLM={onAddXLM}
          onDismiss={onDismiss}
          t={t}
          themeColors={themeColors}
        />
      }
      snapPoints={["65%"]}
      bottomSheetModalProps={{
        onDismiss,
        enableDynamicSizing: false,
      }}
    />
  );
};

export default WelcomeBannerBottomSheet;
