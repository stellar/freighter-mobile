import React from "react";
import ContextMenu, { ContextMenuProps } from "react-native-context-menu-view";

interface ContextMenuButtonProps {
  children: React.ReactNode;
  contextMenuProps: ContextMenuProps;
}

const ContextMenuButton: React.FC<ContextMenuButtonProps> = ({
  children,
  contextMenuProps,
}) => (
  <ContextMenu dropdownMenuMode {...contextMenuProps}>
    {children}
  </ContextMenu>
);

export default ContextMenuButton;
