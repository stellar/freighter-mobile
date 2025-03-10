import { BaseLayout } from "components/layout/BaseLayout";
import { Textarea } from "components/sds/Textarea";
import { THEME } from "config/theme";
import { fs } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 0 18px;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

export const SwapScreen = () => {
  const { t } = useTranslation();

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("swap.title")}</ScreenText>
        <Textarea
          placeholder="Large placeholder message here"
          note="Phrases are usually 12 or 24 words"
          fieldSize="lg"
        />
      </Container>
    </BaseLayout>
  );
};
