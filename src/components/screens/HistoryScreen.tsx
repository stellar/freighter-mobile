import RecoveryPhraseWarningBox from "components/RecoveryPhraseWarningBox";
import { BaseLayout } from "components/layout/BaseLayout";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import useAppTranslation from "helpers/useAppTranslation";
import React from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${px(24)};
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

export const HistoryScreen = () => {
  const { t } = useAppTranslation();

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("history.title")}</ScreenText>

        <RecoveryPhraseWarningBox />
      </Container>
    </BaseLayout>
  );
};
