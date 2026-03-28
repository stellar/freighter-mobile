import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React, { useEffect, useRef } from "react";
import { Image, View } from "react-native";

const PLACEHOLDER_ICON_SIZE = 45;

interface TrendingCardImageProps {
  backgroundUrl?: string;
  showPlaceholder: boolean;
  onShowPlaceholder: () => void;
  onHidePlaceholder: () => void;
}

const TrendingCardImage: React.FC<TrendingCardImageProps> = React.memo(
  ({
    backgroundUrl,
    showPlaceholder,
    onShowPlaceholder,
    onHidePlaceholder,
  }) => {
    const { themeColors } = useColors();
    const imageLoadedRef = useRef(false);

    // Always show placeholder until the image confirms it loaded via onLoad.
    // This avoids a flash of empty space between setting backgroundUrl
    // and the image actually rendering.
    useEffect(() => {
      imageLoadedRef.current = false;
      onShowPlaceholder();
    }, [backgroundUrl, onShowPlaceholder]);

    return (
      <>
        {showPlaceholder && (
          <View className="absolute z-1 items-center justify-center w-full h-full">
            <Icon.Image01
              size={PLACEHOLDER_ICON_SIZE}
              color={themeColors.text.secondary}
            />
          </View>
        )}

        {backgroundUrl && (
          <Image
            source={{ uri: backgroundUrl }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
            onError={onShowPlaceholder}
            onLoad={() => {
              imageLoadedRef.current = true;
              onHidePlaceholder();
            }}
          />
        )}
      </>
    );
  },
);

TrendingCardImage.displayName = "TrendingCardImage";

export default TrendingCardImage;
