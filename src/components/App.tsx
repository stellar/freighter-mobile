import React, {useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {TabNavigator} from '../navigators/TabNavigator';

export const App = (): React.JSX.Element => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
    flex: 1,
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={backgroundStyle}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => setIsLoggedIn(true)}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default App;
