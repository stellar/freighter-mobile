import React from 'react';
import styled from 'styled-components/native';
import {fs} from '../../helpers/dimensions';
import {BaseLayout} from '../layout/BaseLayout';
import {COLORS} from '../../config/theme';

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ScreenText = styled.Text`
  color: ${COLORS.text.default};
  font-size: ${fs(16)};
`;

export const SettingsScreen = () => (
  <BaseLayout>
    <Container>
      <ScreenText>Settings</ScreenText>
    </Container>
  </BaseLayout>
); 