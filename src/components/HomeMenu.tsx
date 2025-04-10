import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  MenuContent,
  MenuItem as MenuItemComponent,
  MenuItemIcon,
  MenuItemTitle,
  MenuRoot,
  MenuTrigger,
} from "components/primitives/Menu";
import Icon from "components/sds/Icon";
import { DEFAULT_PADDING } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import type { SFSymbol } from "sf-symbols-typescript";
import styled from "styled-components/native";

/**
 * Interface for menu items
 * @property key - Unique identifier for the menu item
 * @property title - Display text for the menu item
 * @property icon - Icon configuration for both platforms
 * @property onPress - Callback function when the menu item is pressed
 */
interface MenuItem {
  key: string;
  title: string;
  icon: {
    ios: { name: SFSymbol };
    androidIconName: string;
  };
  onPress: () => void;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Header container for the home screen menu
 */
const HeaderContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${px(DEFAULT_PADDING)};
`;

/**
 * Menu component for the home screen that provides access to settings
 * and other global actions
 */
export const HomeMenu: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useAppTranslation();

  const menuItems: MenuItem[] = [
    {
      key: "settings",
      title: t("settings.title"),
      icon: {
        ios: { name: "gear" },
        androidIconName: "baseline_settings_24",
      },
      onPress: () => navigation.navigate(ROOT_NAVIGATOR_ROUTES.SETTINGS),
    },
  ];

  return (
    <HeaderContainer>
      <MenuRoot>
        <MenuTrigger>
          <Icon.DotsHorizontal size={24} color={THEME.colors.text.primary} />
        </MenuTrigger>
        <MenuContent>
          {menuItems.map((item) => (
            <MenuItemComponent key={item.key} onSelect={item.onPress}>
              <MenuItemTitle>{item.title}</MenuItemTitle>
              <MenuItemIcon
                ios={item.icon.ios}
                androidIconName={item.icon.androidIconName}
              />
            </MenuItemComponent>
          ))}
        </MenuContent>
      </MenuRoot>
    </HeaderContainer>
  );
};
