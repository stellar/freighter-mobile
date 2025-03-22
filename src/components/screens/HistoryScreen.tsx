import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { fs, px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect } from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${px(24)};
`;

const ButtonContainer = styled.View`
  margin-top: ${px(16)};
  width: 100%;
  gap: ${px(12)};
`;

const ErrorText = styled(Text)`
  margin-bottom: ${px(12)};
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(16)};
`;

const LoadingText = styled(Text)`
  margin-bottom: ${px(12)};
`;

export const HistoryScreen = () => {
  const { t } = useAppTranslation();
  const { logout, resetAuthenticationState } = useAuthenticationStore();
  const { account, isLoading, error, fetchActiveAccount } =
    useGetActiveAccount();

  const handleLogout = () => {
    logout();
  };

  const handleResetAuth = () => {
    resetAuthenticationState();
  };

  useEffect(() => {
    fetchActiveAccount();
  }, [fetchActiveAccount]);

  return (
    <BaseLayout>
      <Container>
        <ScreenText>{t("history.title")}</ScreenText>

        {isLoading && <LoadingText>Loading...</LoadingText>}

        {error && <ErrorText color="error">{error}</ErrorText>}

        {account && (
          <>
            <Text>{account.accountName}</Text>
            <Text>{account.publicKey}</Text>
          </>
        )}

        <ButtonContainer>
          <Button onPress={handleLogout}>
            <Text>Logout</Text>
          </Button>

          {error && (
            <Button secondary onPress={handleResetAuth}>
              <Text>Reset Auth State (Debug)</Text>
            </Button>
          )}
        </ButtonContainer>
      </Container>
    </BaseLayout>
  );
};
