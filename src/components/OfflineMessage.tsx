import React from 'react';
import styled from 'styled-components/native';
import {COLORS} from '../config/theme';

const SafeContainer = styled.SafeAreaView`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${COLORS.error};
  z-index: 1;
`;

const Content = styled.View`
  padding: 8px;
  align-items: center;
`;

const Message = styled.Text`
  color: ${COLORS.text.white};
  font-size: 14px;
`;

export const OfflineMessage = () => (
  <SafeContainer>
    <Content>
      <Message>No internet connection</Message>
    </Content>
  </SafeContainer>
); 