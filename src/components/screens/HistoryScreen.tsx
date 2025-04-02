import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useState } from "react";
import { Alert } from "react-native";
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
  gap: ${px(12)};
`;

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { t } = useAppTranslation();
  const { logout, wipeAllDataForDebug } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const [isWiping, setIsWiping] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleWipeData = () => {
    Alert.alert(
      "Debug Action",
      "This will completely wipe all account data and return to welcome screen. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Wipe Everything",
          style: "destructive",
          onPress: () => {
            setIsWiping(true);
            wipeAllDataForDebug()
              .catch((error) => {
                logger.error("handleWipeData", "Failed to wipe data:", error);
              })
              .finally(() => {
                setIsWiping(false);
              });
          },
        },
      ],
    );
  };

  return (
    <BaseLayout>
      <Display sm style={{ alignSelf: "center", marginTop: 40 }}>
        {t("history.title")}
      </Display>

      <Container>
        <ButtonContainer>
          <Text>{account?.publicKey}</Text>

          <Button isFullWidth onPress={handleLogout}>
            {t("logout")}
          </Button>

          <Button
            isFullWidth
            onPress={handleWipeData}
            isLoading={isWiping}
            destructive
          >
            Debug: Wipe All Data
          </Button>
        </ButtonContainer>
      </Container>
    </BaseLayout>
  );
};
