import { THEME } from "config/theme";
import { px, fs } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

const SafeContainer = styled.SafeAreaView`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${THEME.colors.status.error};
  z-index: 1;
`;

const Content = styled.View`
  padding: ${px(8)};
  align-items: center;
`;

const Message = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(14)};
`;

export const OfflineMessage = () => {
  const { t } = useTranslation();

  return (
    <SafeContainer>
      <Content>
        <Message>{t("noInternetConnection")}</Message>
      </Content>
    </SafeContainer>
  );
};
