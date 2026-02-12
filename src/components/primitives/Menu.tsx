import React from "react";
import { View } from "react-native";
import * as DropdownMenu from "zeego/dropdown-menu";

export const MenuRoot = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.create(
  (
    props: React.ComponentProps<typeof DropdownMenu.Trigger> & {
      testID?: string;
    },
  ) => (
    <DropdownMenu.Trigger className="p-2" {...props} asChild>
      <View testID={props.testID} accessible={!!props.testID}>
        {props.children}
      </View>
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

export const MenuGroup = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.Group>) => (
    <DropdownMenu.Group {...props} />
  ),
  "Group",
);

export const MenuSeparator = DropdownMenu.create(
  (props: React.ComponentProps<typeof DropdownMenu.Separator>) => (
    <DropdownMenu.Separator {...props} />
  ),
  "Separator",
);
