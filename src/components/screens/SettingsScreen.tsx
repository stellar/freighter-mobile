import { useNavigation } from "@react-navigation/native";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${px(DEFAULT_PADDING)};
`;

const TitleContainer = styled.View`
  flex: 1;
  align-items: center;
`;

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const { logout } = useAuthenticationStore();
  const { t } = useAppTranslation();

  const handleLogout = () => {
    logout();
  };

  const listItems = [
    {
      icon: <Icon.LogOut01 size={24} color={THEME.colors.list.error} />,
      title: t("settings.logout"),
      titleColor: THEME.colors.list.error,
      onPress: handleLogout,
      testID: "logout-button",
    },
  ];

  return (
    <BaseLayout>
      <Header>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Icon.X size={24} color={THEME.colors.text.primary} />
        </TouchableOpacity>
        <TitleContainer>
          <Text md semiBold>
            {t("settings.title")}
          </Text>
        </TitleContainer>
        <View style={{ width: 24 }} />
      </Header>
      <List items={listItems} />
    </BaseLayout>
  );
};
