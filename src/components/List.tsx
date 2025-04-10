import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";

interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  titleColor?: string;
  trailingContent?: React.ReactNode;
  onPress?: () => void;
}

interface ListProps {
  items: ListItemProps[];
}

const ListContainer = styled.View`
  background-color: ${THEME.colors.background.secondary};
  border-radius: ${px(12)};
`;

const ListItem = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: ${px(16)};
  gap: ${px(12)};
`;

const TitleContainer = styled.View`
  flex: 1;
`;

const Divider = styled.View`
  height: 1px;
  background-color: ${THEME.colors.border.default};
  margin: 0 ${px(16)};
`;

export const List: React.FC<ListProps> = ({ items }) => (
  <ListContainer>
    {items.map((item) => (
      <React.Fragment key={item.title}>
        <ListItem onPress={item.onPress}>
          {item.icon}
          <TitleContainer>
            <Text
              md
              semiBold
              color={item.titleColor || THEME.colors.text.primary}
            >
              {item.title}
            </Text>
          </TitleContainer>
          {item.trailingContent}
        </ListItem>
        {items.indexOf(item) < items.length - 1 && <Divider />}
      </React.Fragment>
    ))}
  </ListContainer>
);
