import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React, { useEffect, useRef } from "react";
import { Image, View } from "react-native";

const IMAGE_LOAD_TIMEOUT = 500;
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
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const imageLoadedRef = useRef(false);

    useEffect(() => {
      if (!backgroundUrl) {
        onShowPlaceholder();
      } else {
        onHidePlaceholder();
        imageLoadedRef.current = false;

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          if (!imageLoadedRef.current) {
            onShowPlaceholder();
          }
        }, IMAGE_LOAD_TIMEOUT);
      }

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backgroundUrl]);

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
              if (timerRef.current) {
                clearTimeout(timerRef.current);
              }
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
