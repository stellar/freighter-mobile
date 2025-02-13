import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Button, ButtonVariant, ButtonSize} from '../../../src/components/sds/Button';

describe('Button', () => {
  const onPressMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    const {getByText} = render(<Button>Test Button</Button>);
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('handles press events', () => {
    const {getByText} = render(
      <Button onPress={onPressMock}>Test Button</Button>,
    );
    
    fireEvent.press(getByText('Test Button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when isLoading is true', () => {
    const {UNSAFE_getByType} = render(
      <Button isLoading>Test Button</Button>,
    );
    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('is disabled when disabled prop is true', () => {
    const {getByText} = render(
      <Button disabled onPress={onPressMock}>
        Test Button
      </Button>,
    );
    
    fireEvent.press(getByText('Test Button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('renders with different variants', () => {
    const {rerender, getByText} = render(<Button>Test Button</Button>);
    
    Object.values(ButtonVariant).forEach(variant => {
      rerender(<Button variant={variant}>Test Button</Button>);
      expect(getByText('Test Button')).toBeTruthy();
    });
  });

  it('renders with different sizes', () => {
    const {rerender, getByText} = render(<Button>Test Button</Button>);
    
    Object.values(ButtonSize).forEach(size => {
      rerender(<Button size={size}>Test Button</Button>);
      expect(getByText('Test Button')).toBeTruthy();
    });
  });
}); 