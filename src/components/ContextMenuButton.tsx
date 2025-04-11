import {
  MenuContent,
  MenuItem as MenuItemComponent,
  MenuItemIcon,
  MenuItemTitle,
  MenuRoot,
  MenuTrigger,
} from "components/primitives/Menu";
import React from "react";
import { View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

interface MenuItem {
  title: string;
  systemIcon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface ContextMenuButtonProps {
  children: React.ReactNode;
  contextMenuProps: {
    actions: MenuItem[];
    onPress?: (e: { nativeEvent: { name: string } }) => void;
  };
}

const ContextMenuButton: React.FC<ContextMenuButtonProps> = ({
  children,
  contextMenuProps,
}) => {
  const { actions, onPress } = contextMenuProps;

  const getIconName = (systemIcon?: string) => {
    if (!systemIcon) return undefined;

    return {
      ios: { name: systemIcon as SFSymbol },
      androidIconName: systemIcon,
    };
  };

  return (
    <MenuRoot>
      <MenuTrigger>
        <View>{children}</View>
      </MenuTrigger>
      <MenuContent>
        {actions.map((action) => (
          <MenuItemComponent
            key={action.title}
            onSelect={() => {
              if (onPress) {
                onPress({ nativeEvent: { name: action.title } });
              } else {
                action.onPress();
              }
            }}
            disabled={action.disabled}
            destructive={action.destructive}
          >
            <MenuItemTitle>{action.title}</MenuItemTitle>
            {action.systemIcon && (
              <MenuItemIcon
                ios={getIconName(action.systemIcon)?.ios}
                androidIconName={
                  getIconName(action.systemIcon)?.androidIconName
                }
              />
            )}
          </MenuItemComponent>
        ))}
      </MenuContent>
    </MenuRoot>
  );
};

export default ContextMenuButton;
