import { ListItemProps } from "components/List";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import React from "react";

/** One label/value row, shared by the About and Token Stats cards. */
export const makeDetailRow = (label: string, value: string): ListItemProps => ({
  titleComponent: (
    <Text md secondary color={THEME.colors.text.secondary}>
      {label}
    </Text>
  ),
  trailingContent: (
    <Text md secondary color={THEME.colors.text.primary}>
      {value}
    </Text>
  ),
});
