import { useNavigation } from "@react-navigation/native";
import ContextMenuButton from "components/ContextMenuButton";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import Icon from "components/sds/Icon";
import { DEFAULT_ICON_SIZE } from "config/constants";
import useColors from "hooks/useColors";
import React, { useLayoutEffect, useCallback } from "react";

/**
 * Hook to set up a right header button with CustomHeaderButton
 *
 * @param options - Configuration object for the button
 * @param options.onPress - Function to call when button is pressed
 * @param options.icon - Custom icon component (optional)
 * @param options.iconSize - Size of the icon (optional, defaults to 24)
 * @param options.className - Additional CSS classes for styling (optional)
 *
 * @example
 * // Basic usage with onPress
 * useRightHeaderButton({ onPress: () => bottomSheetModalRef.current?.present() });
 *
 * @example
 * // With custom icon
 * useRightHeaderButton({
 *   onPress: () => handleAction(),
 *   icon: Icon.Settings,
 *   iconSize: 20
 * });
 *
 * @example
 * // With custom styling
 * useRightHeaderButton({
 *   onPress: () => handleAction(),
 *   className: "w-12 h-12 bg-red-500 rounded-full"
 * });
 */
export const useRightHeaderButton = ({
  onPress,
  icon,
  iconSize,
  className,
}: {
  onPress?: () => void;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconSize?: number;
  className?: string;
}) => {
  const navigation = useNavigation();

  // Memoize the header component outside of the useLayoutEffect to improve
  // performance by preventing unnecessary re-creations of the header component.
  const HeaderRightComponent = useCallback(
    () => (
      <CustomHeaderButton
        position="right"
        onPress={onPress}
        icon={icon}
        iconSize={iconSize}
        className={className}
      />
    ),
    [onPress, icon, iconSize, className],
  );

  // useLayoutEffect is the official recommended hook to use for setting up
  // the navigation headers to prevent UI flickering.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: HeaderRightComponent,
    });
  }, [navigation, HeaderRightComponent]);
};

/**
 * Hook to set up a right header menu button with ContextMenuButton
 *
 * @param options - Configuration object for the menu
 * @param options.actions - Array of menu actions to display
 * @param options.icon - Custom icon component (optional, defaults to Icon.Settings04)
 * @param options.iconColor - Color of the icon (optional)
 *
 * @example
 * // Basic usage with actions
 * useRightHeaderMenu({
 *   actions: [
 *     {
 *       title: "Settings",
 *       onPress: () => navigation.navigate('Settings')
 *     },
 *     {
 *       title: "Help",
 *       onPress: () => openHelp()
 *     }
 *   ]
 * });
 *
 * @example
 * // With custom icon
 * useRightHeaderMenu({
 *   actions: menuActions,
 *   icon: Icon.DotsHorizontal,
 *   iconColor: themeColors.base[1]
 * });
 *
 * @example
 * // With custom icon color
 * useRightHeaderMenu({
 *   actions: menuActions,
 *   iconColor: themeColors.foreground.primary
 * });
 */
export const useRightHeaderMenu = ({
  actions,
  icon,
  iconColor,
}: {
  actions: Array<{
    title: string;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
  }>;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
}) => {
  const navigation = useNavigation();
  const { themeColors } = useColors();

  // Default to themeColors.base[1] if no iconColor is provided
  const finalIconColor = iconColor || themeColors.base[1];

  // Memoize the header component outside of the useLayoutEffect to improve
  // performance by preventing unnecessary re-creations of the header component.
  const HeaderRightComponent = useCallback(
    () => (
      <ContextMenuButton
        contextMenuProps={{
          actions,
        }}
      >
        {icon ? (
          React.createElement(icon, {
            size: DEFAULT_ICON_SIZE,
            color: finalIconColor,
          })
        ) : (
          <Icon.Settings04 size={DEFAULT_ICON_SIZE} color={finalIconColor} />
        )}
      </ContextMenuButton>
    ),
    [actions, icon, finalIconColor],
  );

  // useLayoutEffect is the official recommended hook to use for setting up
  // the navigation headers to prevent UI flickering.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: HeaderRightComponent,
    });
  }, [navigation, HeaderRightComponent]);
};
