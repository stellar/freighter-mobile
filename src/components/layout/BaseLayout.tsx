import React from 'react';
import styled from 'styled-components/native';
import {SafeAreaView, View} from 'react-native';
import {COLORS} from '../../config/theme';

interface BaseLayoutProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  backgroundColor?: string;
}

const StyledSafeAreaView = styled(SafeAreaView)<{backgroundColor?: string}>`
  flex: 1;
  background-color: ${({backgroundColor}) =>
    backgroundColor || COLORS.background.default};
`;

const StyledView = styled(View)<{backgroundColor?: string}>`
  flex: 1;
  background-color: ${({backgroundColor}) =>
    backgroundColor || COLORS.background.default};
`;

export const BaseLayout = ({
  children,
  useSafeArea = true,
  backgroundColor,
}: BaseLayoutProps) => {
  const Container = useSafeArea ? StyledSafeAreaView : StyledView;

  return <Container backgroundColor={backgroundColor}>{children}</Container>;
}; 