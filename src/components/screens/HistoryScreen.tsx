import React from 'react';
import styled from 'styled-components/native';
import {fs} from '../../helpers/dimensions';
import {BaseLayout} from '../layout/BaseLayout';

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  font-size: ${fs(16)};
`;

export const HistoryScreen = () => (
  <BaseLayout>
    <Container>
      <ScreenText>History</ScreenText>
    </Container>
  </BaseLayout>
); 