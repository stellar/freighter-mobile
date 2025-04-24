import {
  MenuContent,
  MenuGroup,
  MenuItem as MenuItemComponent,
  MenuItemIcon,
  MenuItemTitle,
  MenuRoot,
  MenuTrigger,
} from "components/primitives/Menu";
import React from "react";
import { View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export interface MenuItem {
  title?: string;
  systemIcon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  actions?: MenuItem[];
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

  const renderMenuItem = (item: MenuItem) => (
    <MenuItemComponent
      key={item.title ?? Math.random().toString()}
      onSelect={() => {
        if (onPress) {
          onPress({ nativeEvent: { name: item.title ?? "" } });
        } else {
          item.onPress?.();
        }
      }}
      disabled={item.disabled}
      destructive={item.destructive}
    >
      <MenuItemTitle>{item.title}</MenuItemTitle>
      {item.systemIcon && (
        <MenuItemIcon
          ios={getIconName(item.systemIcon)?.ios}
          androidIconName={getIconName(item.systemIcon)?.androidIconName}
        />
      )}
    </MenuItemComponent>
  );

  return (
    <MenuRoot>
      <MenuTrigger>
        <View>{children}</View>
      </MenuTrigger>
      <MenuContent>
        {actions.map((action) =>
          action.actions ? (
            <MenuGroup key={action.title ?? Math.random().toString()}>
              {action.actions.map((nestedAction) =>
                renderMenuItem(nestedAction),
              )}
            </MenuGroup>
          ) : (
            renderMenuItem(action)
          ),
        )}
      </MenuContent>
    </MenuRoot>
  );
};

export default ContextMenuButton;
