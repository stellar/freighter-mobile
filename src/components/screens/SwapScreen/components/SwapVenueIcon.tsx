import { SwapRouteVenue } from "components/screens/SwapScreen/helpers";
import Icon from "components/sds/Icon";
import { pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";

interface SwapVenueIconProps {
  venue: SwapRouteVenue;
  size: number;
  /** Draws a ring in the sheet's background so overlapping icons separate. */
  ringColor?: string;
}

export const SwapVenueIcon: React.FC<SwapVenueIconProps> = ({
  venue,
  size,
  ringColor,
}) => {
  const { themeColors } = useColors();
  const [failed, setFailed] = useState(false);
  const dimension = pxValue(size);
  const ring = ringColor ? pxValue(2) : 0;
  const containerStyle = {
    width: dimension + ring * 2,
    height: dimension + ring * 2,
    borderRadius: (dimension + ring * 2) / 2,
    borderWidth: ring,
    borderColor: ringColor,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: themeColors.background.secondary,
  };

  if (!venue.iconUrl || failed) {
    return (
      <View style={containerStyle} testID="swap-venue-icon-generic">
        <Icon.CoinsSwap01
          size={Math.round(dimension * 0.6)}
          color={themeColors.foreground.secondary}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle} testID="swap-venue-icon">
      {venue.iconUrl.toLowerCase().endsWith(".svg") ? (
        <SvgUri
          uri={venue.iconUrl}
          width={dimension}
          height={dimension}
          onError={() => setFailed(true)}
        />
      ) : (
        <Image
          source={{ uri: venue.iconUrl }}
          style={{ width: dimension, height: dimension }}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
};

interface SwapVenueIconStackProps {
  venues: SwapRouteVenue[];
  size: number;
  /** Negative overlaps the icons; positive spaces them. */
  spacing: number;
  ringColor?: string;
}

export const SwapVenueIconStack: React.FC<SwapVenueIconStackProps> = ({
  venues,
  size,
  spacing,
  ringColor,
}) => (
  <View className="flex-row items-center">
    {venues.map((venue, index) => (
      <View
        // eslint-disable-next-line react/no-array-index-key
        key={`${venue.name}-${index}`}
        style={{ marginLeft: index === 0 ? 0 : pxValue(spacing) }}
      >
        <SwapVenueIcon venue={venue} size={size} ringColor={ringColor} />
      </View>
    ))}
  </View>
);
