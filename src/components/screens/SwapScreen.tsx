import React from 'react';
import styled from 'styled-components/native';
import {fs} from '../../helpers/dimensions';

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  font-size: ${fs(16)};
`;

export const SwapScreen = () => (
  <Container>
    <ScreenText>Swap</ScreenText>
  </Container>
); 