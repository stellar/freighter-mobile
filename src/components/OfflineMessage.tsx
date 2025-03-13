import { THEME } from "config/theme";
import { px, fs } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface StyledViewProps {
  $insets: EdgeInsets;
}

const SafeContainer = styled.View<StyledViewProps>`
  padding-top: ${({ $insets }: StyledViewProps) => $insets.top}px;
  padding-left: ${({ $insets }: StyledViewProps) => $insets.left}px;
  padding-right: ${({ $insets }: StyledViewProps) => $insets.right}px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${THEME.colors.status.error};
  z-index: 1;
`;

const Content = styled.View`
  padding: ${px(12)};
  align-items: center;
`;

const Message = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(14)};
`;

export const OfflineMessage = () => {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  return (
    <SafeContainer $insets={insets}>
      <Content>
        <Message>{t("noInternetConnection")}</Message>
      </Content>
    </SafeContainer>
  );
};
