import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {LoginScreen} from '../../../src/components/screens/LoginScreen';

// Mock useNavigation hook
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    replace: mockReplace,
  })),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const {getByText} = render(<LoginScreen />);
    expect(getByText('Login')).toBeTruthy();
  });

  it('navigates to main tabs when login button is pressed', () => {
    const {getByText} = render(<LoginScreen />);
    const loginButton = getByText('Login');
    
    fireEvent.press(loginButton);
    
    expect(mockReplace).toHaveBeenCalledWith('MainTabs');
  });
}); 