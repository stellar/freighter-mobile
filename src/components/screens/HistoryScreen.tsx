import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect } from "react";
import styled from "styled-components/native";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

const Container = styled.View`
  margin-top: ${px(100)};
  flex: 1;
  justify-content: center;
  align-items: center;
  gap: ${px(12)};
`;

const ButtonContainer = styled.View`
  margin-top: auto;
  width: 100%;
  margin-bottom: ${px(24)};
`;

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { t } = useAppTranslation();
  const { logout } = useAuthenticationStore();
  const { refreshAccount } = useGetActiveAccount();

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  return (
    <BaseLayout>
      <Display sm style={{ alignSelf: "center", marginTop: 40 }}>
        {t("history.title")}
      </Display>

      <Container>
        <ButtonContainer>
          <Button isFullWidth onPress={handleLogout}>
            <Text>Logout</Text>
          </Button>
        </ButtonContainer>
      </Container>
    </BaseLayout>
  );
};
