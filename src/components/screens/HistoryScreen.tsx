import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect } from "react";
import styled from "styled-components/native";

const Container = styled.View`
  margin-top: ${px(100)};
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${px(24)};
  gap: ${px(12)};
`;

const ButtonContainer = styled.View`
  margin-top: auto;
  width: 100%;
  margin-bottom: ${px(24)};
`;

export const HistoryScreen = () => {
  const { t } = useAppTranslation();
  const { logout } = useAuthenticationStore();
  const { account, isLoading, error, fetchActiveAccount } =
    useGetActiveAccount();

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    fetchActiveAccount();
  }, [fetchActiveAccount]);

  return (
    <BaseLayout>
      <Display sm style={{ alignSelf: "center", marginTop: 40 }}>
        {t("history.title")}
      </Display>

      <Container>
        {isLoading && <Text>Loading...</Text>}

        {error && <Text color={THEME.colors.status.error}>{error}</Text>}

        {account && (
          <>
            <Text>{account.accountName}</Text>
            <Text>{account.publicKey}</Text>
          </>
        )}

        <ButtonContainer>
          <Button isFullWidth onPress={handleLogout}>
            <Text>Logout</Text>
          </Button>
        </ButtonContainer>
      </Container>
    </BaseLayout>
  );
};
