import Icon from "components/sds/Icon";
import { ThemeColors } from "hooks/useColors";
import React from "react";

export const renderIconComponent = ({
  iconComponent,
  themeColors,
}: {
  iconComponent?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (iconComponent) {
    return iconComponent;
  }

  return (
    <Icon.User01 circle color={themeColors.foreground.primary} size={26} />
  );
};

export const renderActionIcon = ({
  actionIcon,
  themeColors,
}: {
  actionIcon?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (actionIcon) {
    return actionIcon;
  }

  return <Icon.Wallet03 color={themeColors.foreground.primary} size={16} />;
};
