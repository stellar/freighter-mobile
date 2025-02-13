import React from 'react';
import styled from 'styled-components/native';
import {COLORS} from '../config/theme';
import {px, fs} from '../helpers/dimensions';

const SafeContainer = styled.SafeAreaView`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${COLORS.error};
  z-index: 1;
`;

const Content = styled.View`
  padding: ${px(8)};
  align-items: center;
`;

const Message = styled.Text`
  color: ${COLORS.text.default};
  font-size: ${fs(14)};
`;

export const OfflineMessage = () => (
  <SafeContainer>
    <Content>
      <Message>No internet connection</Message>
    </Content>
  </SafeContainer>
); 