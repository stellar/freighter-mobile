import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import styled from "styled-components/native";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  gap: ${px(12)};
`;

const ButtonContainer = styled.View`
  margin-top: auto;
  width: 100%;
  margin-bottom: ${px(24)};
  gap: ${px(12)};
`;

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { t } = useAppTranslation();
  const { logout } = useAuthenticationStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <BaseLayout insets={{ bottom: false }}>
      <Display sm style={{ alignSelf: "center" }}>
        {t("history.title")}
      </Display>

      <Container>
        <ButtonContainer>
          <Button isFullWidth onPress={handleLogout}>
            {t("logout")}
          </Button>
        </ButtonContainer>
      </Container>
    </BaseLayout>
  );
};
