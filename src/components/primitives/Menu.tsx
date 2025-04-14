import React from "react";
import { View } from "react-native";
import * as DropdownMenu from "zeego/dropdown-menu";

export const MenuRoot = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.Trigger>) => (
    <DropdownMenu.Trigger {...props} asChild>
      <View>{props.children}</View>
    </DropdownMenu.Trigger>
  ),
  "Trigger",
);
export const MenuContent = DropdownMenu.Content;
export const MenuItem = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.Item>) => (
    <DropdownMenu.Item {...props} />
  ),
  "Item",
);

export const MenuItemTitle = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.ItemTitle>) => (
    <DropdownMenu.ItemTitle {...props} />
  ),
  "ItemTitle",
);

export const MenuItemIcon = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.ItemIcon>) => (
    <DropdownMenu.ItemIcon {...props} />
  ),
  "ItemIcon",
);
