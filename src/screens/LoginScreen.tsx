import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import styled from 'styled-components/native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {useColorScheme} from 'react-native';
import {ROUTES, RootStackParamList} from '../config/routes';
import {COLORS} from '../config/theme';
import {px, fs} from '../helpers/dimensions';

const SafeArea = styled.SafeAreaView<{isDark: boolean}>`
  flex: 1;
  background-color: ${({isDark}) =>
    isDark ? COLORS.background.dark : COLORS.background.light};
`;

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
  color: ${COLORS.button.text};
  font-size: ${fs(16)};
`;

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  typeof ROUTES.LOGIN
>;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeArea isDark={isDarkMode}>
      <Container>
        <LoginButton onPress={() => navigation.replace(ROUTES.MAIN_TABS)}>
          <LoginText>Login</LoginText>
        </LoginButton>
      </Container>
    </SafeArea>
  );
}; 