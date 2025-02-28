import { BaseLayout } from "components/layout/BaseLayout";
import { THEME } from "config/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

export const HistoryScreen = () => {
  const { t } = useTranslation();

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("history.title")}</ScreenText>
      </Container>
    </BaseLayout>
  );
};
