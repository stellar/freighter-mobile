import useColors from "hooks/useColors";
import React from "react";
import { StyleSheet, View } from "react-native";

/** Figma's focus ring: box-shadow 0 0 0 4px rgba(143, 143, 143, 0.12). */
export const FOCUS_RING_WIDTH = 4;
const RING_COLOR = "rgba(143, 143, 143, 0.12)";
/** The corner radius of Varial's outline fields (Input and Textarea xl). */
const FIELD_RADIUS = 16;

const styles = StyleSheet.create({
  ring: {
    margin: -FOCUS_RING_WIDTH,
    borderWidth: FOCUS_RING_WIDTH,
    borderRadius: FIELD_RADIUS + FOCUS_RING_WIDTH,
  },
  fill: {
    borderRadius: FIELD_RADIUS,
  },
});

interface FocusRingProps {
  isFocused: boolean;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Varial's focus state for an outline field: while focused, the field fills
 * with the page's base color and a soft 4pt ring shows around its corners,
 * in both color schemes. The ring sits in a negative margin, so the field
 * keeps its place whether focused or not. A parent that clips its content,
 * as a ScrollView does, needs FOCUS_RING_WIDTH of room around the field.
 *
 * Design: Set Password ?node-id=370-8343, Import Wallet ?node-id=2091-40745.
 */
export const FocusRing: React.FC<FocusRingProps> = ({
  isFocused,
  children,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <View
      testID={testID}
      style={[
        styles.ring,
        { borderColor: isFocused ? RING_COLOR : "transparent" },
      ]}
    >
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          {
            backgroundColor: isFocused ? themeColors.base[0] : "transparent",
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};
