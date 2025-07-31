import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity } from "react-native";

interface BottomNavigationProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onNewTab: () => void;
  contextMenuActions: MenuItem[];
}

// Memoize to avoid unnecessary expensive re-renders
const BottomNavigation: React.FC<BottomNavigationProps> = React.memo(
  ({
    canGoBack,
    canGoForward,
    onGoBack,
    onGoForward,
    onNewTab,
    contextMenuActions,
  }) => {
    const { themeColors } = useColors();

    return (
      <View className="flex-row items-center justify-between bg-background-primary border-t border-border-primary pl-2 pr-5">
        <TouchableOpacity
          onPress={onGoBack}
          disabled={!canGoBack}
          className="p-4"
        >
          <Icon.ChevronLeft
            color={canGoBack ? themeColors.base[1] : themeColors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onGoForward}
          disabled={!canGoForward}
          className="p-4"
        >
          <Icon.ChevronRight
            color={
              canGoForward ? themeColors.base[1] : themeColors.text.secondary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onNewTab} className="p-4">
          <Icon.Plus color={themeColors.base[1]} />
        </TouchableOpacity>

        <ContextMenuButton
          contextMenuProps={{
            actions: contextMenuActions,
          }}
          side="top"
          align="end"
          sideOffset={8}
        >
          <Icon.DotsHorizontal color={themeColors.base[1]} />
        </ContextMenuButton>
      </View>
    );
  },
);

BottomNavigation.displayName = "BottomNavigation";

export default BottomNavigation;
