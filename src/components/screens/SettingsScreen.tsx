import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import styled from 'styled-components/native';
import { fs } from '../../helpers/dimensions';
import { BaseLayout } from '../layout/BaseLayout';
import { THEME } from '../../config/sds/theme';
import { Button, ButtonVariant, ButtonSize } from '../sds/Button';
import { ROUTES, RootStackParamList } from '../../config/routes';

const Container = styled.View`
  flex: 1;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`;

const TopSection = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${THEME.colors.text.default};
  font-size: ${fs(16)};
`;

type SettingsScreenNavigationProp = NativeStackNavigationProp<
RootStackParamList,
  typeof ROUTES.MAIN_TABS
>;

export const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleSignOut = () => {
    navigation.replace(ROUTES.LOGIN);
  };

  return (
    <BaseLayout>
      <Container>
        <TopSection>
          <ScreenText>Settings</ScreenText>
        </TopSection>
        <Button
          variant={ButtonVariant.DESTRUCTIVE}
          size={ButtonSize.LARGE}
          onPress={handleSignOut}
        >
          Sign out
        </Button>
      </Container>
    </BaseLayout>
  );
};
