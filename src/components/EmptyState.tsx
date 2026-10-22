import {
  SPARKLE_GRAPHIC_SIZE,
  SparkleGraphic,
} from "components/WalletSetupOverlay/SparkleGraphic";
import { Text } from "components/sds/Typography";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { fsValue, pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React from "react";
import { StyleProp, View, ViewStyle, useColorScheme } from "react-native";

/**
 * The card's geometry, in Figma points (the Empty component set,
 * ?node-id=208-13041).
 */
const CARD = {
  height: 280,
  paddingVertical: 16,
  borderRadius: 24,
  /** Between the top block and the action. */
  gap: 16,
};

/** The tokens card's side padding; the collectibles card's is 32. */
const DEFAULT_CONTENT_PADDING_HORIZONTAL = 24;

/**
 * Light mode's card fill. Figma paints it with this raw hex, not a color
 * token. The dark card has no fill.
 */
const LIGHT_CARD_BACKGROUND = "#F5F7F9";

/** Between the icon and the text. */
const TOP_BLOCK_GAP = 8;
/** Around the sparkle, inside its circle. */
const ICON_PADDING = 8;
/** Figma rounds the circle with a 1000pt radius. */
const ICON_RADIUS = 1000;
/** Between the title and the description. */
const TEXT_GAP = 4;
/**
 * Figma's Text/SM is 14/20. `TEXT_SIZES.sm` stays 14/22 for the rest of the
 * app, so the description sets its line height itself, as the token rows do.
 */
const DESCRIPTION_LINE_HEIGHT = 20;

/** Figma's "Group 19" box, which the sparkle's canvas hangs from. */
const SPARKLE_BOX = { width: 24.141, height: 24 };
/**
 * Figma draws the canvas at inset 0 −11.48% −28.51% −11.48% of the box: from
 * its top, 11.48% of its width to its left. The glow runs past the box down
 * and to the sides, still inside the circle, and nothing clips it.
 */
const SPARKLE_CANVAS_LEFT = -0.1148 * SPARKLE_BOX.width;

interface EmptyStateProps {
  title: string;
  description?: string;
  /** The action under the text (e.g. a fund button), in the card itself. */
  children?: React.ReactNode;
  /**
   * The card's side padding, in Figma points: 24 on the tokens card (the
   * default) and 32 on the collectibles card.
   */
  contentPaddingHorizontal?: number;
  /** The caller's outer margins, to place the card in its container. */
  style?: StyleProp<ViewStyle>;
  /** On the card; its icon circle and sparkle add `-icon` and `-sparkle`. */
  testID?: string;
}

/**
 * Home's empty-state card, from Figma's Empty component (?node-id=208-13041):
 * Varial's sparkle in a circle, over a title and an optional description, and
 * the optional action at the bottom. Light mode fills the card; dark mode
 * leaves it unfilled.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  children,
  contentPaddingHorizontal = DEFAULT_CONTENT_PADDING_HORIZONTAL,
  style,
  testID,
}) => {
  const { themeColors } = useColors();
  const isLight = (useColorScheme() ?? DEFAULT_COLOR_SCHEME) === "light";

  return (
    <View
      testID={testID}
      style={[
        {
          // A minimum rather than a fixed height: the same 280pt at the
          // default text size, and room to grow with larger accessibility
          // text instead of spilling out of the card.
          minHeight: pxValue(CARD.height),
          paddingVertical: pxValue(CARD.paddingVertical),
          paddingHorizontal: pxValue(contentPaddingHorizontal),
          borderRadius: pxValue(CARD.borderRadius),
          gap: pxValue(CARD.gap),
          alignItems: "center",
          backgroundColor: isLight ? LIGHT_CARD_BACKGROUND : "transparent",
        },
        style,
      ]}
    >
      <View
        style={{
          alignSelf: "stretch",
          alignItems: "center",
          gap: pxValue(TOP_BLOCK_GAP),
        }}
      >
        {/* Blue/03 in light mode and Blue/02 in dark */}
        <View
          testID={testID ? `${testID}-icon` : undefined}
          style={{
            padding: pxValue(ICON_PADDING),
            borderRadius: ICON_RADIUS,
            backgroundColor: isLight
              ? themeColors.lilac[3]
              : themeColors.lilac[2],
          }}
        >
          <View
            style={{
              width: pxValue(SPARKLE_BOX.width),
              height: pxValue(SPARKLE_BOX.height),
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                left: pxValue(SPARKLE_CANVAS_LEFT),
              }}
            >
              <SparkleGraphic
                isLight={isLight}
                testID={testID ? `${testID}-sparkle` : undefined}
                width={pxValue(SPARKLE_GRAPHIC_SIZE.width)}
                height={pxValue(SPARKLE_GRAPHIC_SIZE.height)}
              />
            </View>
          </View>
        </View>

        <View style={{ alignSelf: "stretch", gap: pxValue(TEXT_GAP) }}>
          <Text md semiBold primary textAlign="center">
            {title}
          </Text>
          {description ? (
            <Text
              sm
              secondary
              textAlign="center"
              style={{ lineHeight: fsValue(DESCRIPTION_LINE_HEIGHT) }}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
};

export default EmptyState;
