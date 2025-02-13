import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import styled from 'styled-components/native';
import {ROUTES, RootStackParamList} from '../../config/routes';
import {COLORS} from '../../config/theme';
import {px, fs} from '../../helpers/dimensions';
import {BaseLayout} from '../layout/BaseLayout';

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const LoginButton = styled.TouchableOpacity`
  background-color: ${COLORS.button.primary};
  padding: ${px(15)};
  border-radius: ${px(5)};
`;

const LoginText = styled.Text`
  color: ${COLORS.text.default};
  font-size: ${fs(16)};
`;

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.LOGIN
>;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  
  return (
    <BaseLayout useSafeArea>
      <Container>
        <LoginButton onPress={() => navigation.replace(ROUTES.MAIN_TABS)}>
          <LoginText>Login</LoginText>
        </LoginButton>
      </Container>
    </BaseLayout>
  );
}; 