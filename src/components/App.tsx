import React, {useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {useColorScheme} from 'react-native';
import styled from 'styled-components/native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {Provider} from 'react-redux';
import {TabNavigator} from '../navigators/TabNavigator';
import {store} from '../config/store';

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

export const App = (): React.JSX.Element => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';

  if (!isLoggedIn) {
    return (
      <Provider store={store}>
        <SafeArea isDark={isDarkMode}>
          <Container>
            <LoginButton onPress={() => setIsLoggedIn(true)}>
              <LoginText>Login</LoginText>
            </LoginButton>
          </Container>
        </SafeArea>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </Provider>
  );
};

export default App;
