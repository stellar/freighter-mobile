import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

export interface EarnDetailsRow {
  key: string;
  label: string;
  /** A plain value renders as medium primary text; pass an element for
   * anything richer, such as a two-tone "before → after". */
  value: React.ReactNode;
  /** Explicit color for a plain value, e.g. a green APY. */
  valueColor?: string;
  /** Semibold plain value, as the APY figures are. */
  isEmphasized?: boolean;
  testID?: string;
}

/**
 * Earn's label/value card: secondary labels on the left, values on the
 * right, hairlines between rows (never after the last one). Used by the pool
 * details sheet and the deposit review.
 */
export const EarnDetailsCard: React.FC<{
  rows: EarnDetailsRow[];
  testID?: string;
}> = ({ rows, testID }) => (
  <View
    className="gap-[12px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
    testID={testID}
  >
    {rows.map((row, index) => (
      <React.Fragment key={row.key}>
        <View className="flex-row items-center justify-between gap-[12px]">
          <Text md medium secondary>
            {row.label}
          </Text>
          {typeof row.value === "string" ? (
            <Text
              md
              medium={!row.isEmphasized}
              semiBold={row.isEmphasized}
              primary
              color={row.valueColor}
              testID={row.testID}
            >
              {row.value}
            </Text>
          ) : (
            <View testID={row.testID}>{row.value}</View>
          )}
        </View>
        {index < rows.length - 1 && (
          <View className="h-px w-full bg-border-primary" />
        )}
      </React.Fragment>
    ))}
  </View>
);

export default EarnDetailsCard;
