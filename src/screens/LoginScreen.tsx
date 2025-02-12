import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import styled from 'styled-components/native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {useColorScheme} from 'react-native';
import {ROUTES, RootStackParamList} from '../config/routes';

const SafeArea = styled.SafeAreaView<{isDark: boolean}>`
  flex: 1;
  background-color: ${({isDark}) =>
    isDark ? Colors.darker : Colors.lighter};
`;

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const LoginButton = styled.TouchableOpacity`
  background-color: #2196F3;
  padding: 15px;
  border-radius: 5px;
`;

const LoginText = styled.Text`
  color: white;
  font-size: 16px;
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