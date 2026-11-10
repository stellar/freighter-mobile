import Icon from "components/sds/Icon";
import { decodeDataUri } from "helpers/dataUri";
import useColors from "hooks/useColors";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";

type ResizeMode = "cover" | "contain" | "stretch" | "repeat" | "center";

// Closest SVG equivalent of each Image resize mode
const SVG_ASPECT_RATIO: Record<ResizeMode, string> = {
  cover: "xMidYMid slice",
  contain: "xMidYMid meet",
  center: "xMidYMid meet",
  repeat: "xMidYMid meet",
  stretch: "none",
};

// A malformed SVG falls back to the placeholder; nothing else to report.
const ignoreSvgError = () => undefined;

/**
 * Props for the CollectibleImage component
 */
interface CollectibleImageProps {
  /** The image URI to display */
  imageUri?: string;
  /** The size of the placeholder icon */
  placeholderIconSize?: number;
  /** Additional className for the container */
  containerClassName?: string;
  /** Additional className for the image */
  imageClassName?: string;
  /** Image resize mode */
  resizeMode?: ResizeMode;
}

/**
 * CollectibleImage Component
 *
 * A reusable component for displaying collectible images with a fallback placeholder.
 * Features include:
 * - Displays collectible image with proper sizing
 * - Renders inline SVG images (`data:image/svg+xml`), which Image can't show
 * - Shows placeholder icon after 500ms if image hasn't loaded
 * - Shows placeholder icon immediately when image fails to load
 * - Handles image loading states with timeout
 * - Customizable placeholder icon size
 * - Flexible styling through className props
 *
 * @param {CollectibleImageProps} props - Component props
 * @returns {JSX.Element} The collectible image component
 */
export const CollectibleImage: React.FC<CollectibleImageProps> = ({
  imageUri = "",
  placeholderIconSize = 45,
  containerClassName = "w-full h-full",
  imageClassName = "w-full h-full",
  resizeMode = "cover",
}) => {
  const { themeColors } = useColors();
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const imageLoadedRef = useRef(false);

  // Some contracts embed the artwork as an inline SVG data URI. Image does
  // not render SVG, so those are drawn with react-native-svg instead.
  const svgXml = useMemo(
    () => decodeDataUri(imageUri, "image/svg+xml"),
    [imageUri],
  );

  // Show placeholder after 500ms if image hasn't loaded, or immediately on error
  useEffect(() => {
    if (!imageUri) {
      setShowPlaceholder(true);
    } else if (svgXml !== null) {
      // Inline SVG renders synchronously, so there is no load to wait for
      setShowPlaceholder(false);
    } else {
      // Reset states when imageUri changes
      setShowPlaceholder(false);
      imageLoadedRef.current = false;

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set a timer to show placeholder after 500ms if image hasn't loaded
      timerRef.current = setTimeout(() => {
        if (!imageLoadedRef.current) {
          setShowPlaceholder(true);
        }
      }, 500);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [imageUri, svgXml]);

  return (
    <View
      className={`${containerClassName} bg-background-tertiary`}
      testID="collectible-image-container"
    >
      {/* Placeholder icon - shown after 500ms if image hasn't loaded, or immediately when image fails to load */}
      {showPlaceholder && (
        <View className="absolute z-1 items-center justify-center w-full h-full">
          <Icon.Image01
            size={placeholderIconSize}
            color={themeColors.text.secondary}
            testID="collectible-image-placeholder"
          />
        </View>
      )}

      {/* NFT image */}
      {svgXml !== null ? (
        <View className={imageClassName} testID="collectible-image-svg">
          <SvgXml
            xml={svgXml}
            override={{
              width: "100%",
              height: "100%",
              preserveAspectRatio: SVG_ASPECT_RATIO[resizeMode],
            }}
            onError={ignoreSvgError}
            fallback={
              <View className="items-center justify-center w-full h-full">
                <Icon.Image01
                  size={placeholderIconSize}
                  color={themeColors.text.secondary}
                  testID="collectible-image-placeholder"
                />
              </View>
            }
          />
        </View>
      ) : (
        <Image
          source={{ uri: imageUri }}
          className={imageClassName}
          resizeMode={resizeMode}
          onError={() => setShowPlaceholder(true)}
          onLoad={() => {
            imageLoadedRef.current = true;
            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }
            setShowPlaceholder(false);
          }}
          testID="collectible-image"
        />
      )}
    </View>
  );
};

CollectibleImage.displayName = "CollectibleImage";
