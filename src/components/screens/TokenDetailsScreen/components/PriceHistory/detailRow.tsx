import { ListItemProps } from "components/List";
import { Text } from "components/sds/Typography";
import React from "react";

/** One label/value row, shared by the About and Token Stats cards. */
export const makeDetailRow = (label: string, value: string): ListItemProps => ({
  titleComponent: (
    <Text md secondary>
      {label}
    </Text>
  ),
  trailingContent: <Text md>{value}</Text>,
});
