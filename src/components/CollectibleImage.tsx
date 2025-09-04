import Icon from "components/sds/Icon";
import useColors from "hooks/useColors";
import React, { useState } from "react";
import { Image, View } from "react-native";

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
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
}

/**
 * CollectibleImage Component
 *
 * A reusable component for displaying collectible images with a fallback placeholder.
 * Features include:
 * - Displays collectible image with proper sizing
 * - Shows placeholder icon when image fails to load or is loading
 * - Handles image loading states
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !imageLoaded || imageError;

  return (
    <View className={`${containerClassName} bg-background-tertiary`}>
      {/* Placeholder icon - shown when image is loading or failed to load */}
      {showPlaceholder && (
        <View className="absolute z-1 items-center justify-center w-full h-full">
          <Icon.Image01
            size={placeholderIconSize}
            color={themeColors.text.secondary}
          />
        </View>
      )}

      {/* NFT image */}
      <Image
        source={{ uri: imageUri }}
        className={imageClassName}
        resizeMode={resizeMode}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </View>
  );
};

CollectibleImage.displayName = "CollectibleImage";
