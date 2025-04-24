/* eslint-disable react/no-array-index-key */
import { Canvas, Rect } from "@shopify/react-native-skia";
import Icon from "components/sds/Icon";
import { THEME } from "config/theme";
import {
  HSVtoRGB,
  publicKeyToBytes,
  generateMatrix,
  DEFAULT_MATRIX_SIZE,
} from "helpers/stellarIdenticon";
import React from "react";
import { View, Text } from "react-native";

// Constants for sizes
export const AvatarSizes = {
  SMALL: "sm",
  MEDIUM: "md",
  LARGE: "lg",
} as const;

export type AvatarSize = (typeof AvatarSizes)[keyof typeof AvatarSizes];

const AVATAR_DIMENSIONS = {
  [AvatarSizes.SMALL]: {
    dimension: 24,
    fontSize: 12,
    width: 26,
    height: 26,
    iconSize: 12,
  },
  [AvatarSizes.MEDIUM]: {
    dimension: 36,
    fontSize: 16,
    width: 38,
    height: 38,
    iconSize: 18,
  },
  [AvatarSizes.LARGE]: {
    dimension: 48,
    fontSize: 18,
    width: 50,
    height: 50,
    iconSize: 24,
  },
} as const;

/**
 * Base props for the Avatar component
 */
export interface AvatarBaseProps {
  /** Avatar size */
  size?: AvatarSize;
  /** Optional test ID for testing */
  testID?: string;
  /** Whether to show border */
  hasBorder?: boolean;
}

/**
 * Props for Avatar with a Stellar address
 */
export interface AvatarStellarAddressProps {
  /** Public Stellar address */
  publicAddress: string;
  userName?: undefined;
}

/**
 * Props for Avatar with a username
 */
export interface AvatarUserNameProps {
  /** User name for initials */
  userName: string;
  publicAddress?: undefined;
}

/**
 * Props for the Avatar component
 */
export type AvatarProps = (
  | AvatarStellarAddressProps
  | AvatarUserNameProps
  | {
      userName?: undefined;
      publicAddress?: undefined;
    }
) &
  AvatarBaseProps;

/**
 * Avatar component
 *
 * A customizable avatar component that displays:
 * - A Stellar identicon based on a public Stellar address
 * - Initials for a userName
 * - A default user icon when no data is provided
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Avatar size="md" />
 * ```
 *
 * @example
 * With Stellar address:
 * ```tsx
 * <Avatar
 *   size="md"
 *   publicAddress="GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM"
 * />
 * ```
 *
 * @example
 * With username:
 * ```tsx
 * <Avatar size="md" userName="John Doe" />
 * ```
 */
export const Avatar: React.FC<AvatarProps> = ({
  size = AvatarSizes.MEDIUM,
  publicAddress,
  userName,
  testID,
  hasBorder = true,
}) => {
  const getSizeClasses = () => {
    const classes: Record<AvatarSize, string> = {
      sm: "w-[26px] h-[26px]",
      md: "w-[38px] h-[38px]",
      lg: "w-[50px] h-[50px]",
    };

    return classes[size];
  };

  const getTextSizeClass = () => {
    const classes: Record<AvatarSize, string> = {
      sm: "text-xs",
      md: "text-base",
      lg: "text-lg",
    };

    return classes[size];
  };

  // Get initials from username
  const getInitials = (name: string): string => {
    const arr = name.split(" ");
    if (arr.length >= 2) {
      return `${arr[0].charAt(0)}${arr[1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Render Stellar identicon
  const renderIdenticon = () => {
    if (!publicAddress) return null;

    const bytes = publicKeyToBytes(publicAddress);
    const matrix = generateMatrix(bytes, true);
    const { r, g, b } = HSVtoRGB(bytes[0] / 255, 0.7, 0.8);
    const rgbColor = `rgb(${r}, ${g}, ${b})`;

    const { dimension } = AVATAR_DIMENSIONS[size];
    const padding = Math.max(2, Math.floor(dimension * 0.2));
    const availableSpace = dimension - padding * 2;
    const cellSize = Math.floor(availableSpace / DEFAULT_MATRIX_SIZE);
    const totalSize = cellSize * DEFAULT_MATRIX_SIZE;
    const offset = (availableSpace - totalSize) / 2;

    const containerClasses = `${getSizeClasses()} rounded-full overflow-hidden justify-center items-center ${
      hasBorder ? "border border-border-primary" : ""
    } bg-background-primary`;

    return (
      <View className={containerClasses} testID={testID}>
        <View className="justify-center items-center">
          <Canvas
            style={{
              width: availableSpace,
              height: availableSpace,
            }}
          >
            {matrix.map((row, rowIndex) =>
              row.map(
                (cell, colIndex) =>
                  cell && (
                    <Rect
                      key={`${publicAddress}-${rowIndex}-${colIndex}`}
                      x={offset + cellSize * colIndex}
                      y={offset + cellSize * rowIndex}
                      width={cellSize + 0.5}
                      height={cellSize + 0.5}
                      color={rgbColor}
                    />
                  ),
              ),
            )}
          </Canvas>
        </View>
      </View>
    );
  };

  const renderDefaultIcon = () => {
    const containerClasses = `${getSizeClasses()} rounded-full overflow-hidden justify-center items-center ${
      hasBorder ? "border border-border-primary" : ""
    } bg-background-primary`;

    return (
      <View className={containerClasses} testID={testID}>
        <Icon.User01
          size={AVATAR_DIMENSIONS[size].iconSize}
          color={THEME.colors.text.secondary}
        />
      </View>
    );
  };

  const renderInitials = (initials: string) => {
    const containerClasses = `${getSizeClasses()} rounded-full overflow-hidden justify-center items-center ${
      hasBorder ? "border border-border-primary" : ""
    } bg-background-primary`;

    return (
      <View className={containerClasses} testID={testID}>
        <Text className={`font-bold text-text-secondary ${getTextSizeClass()}`}>
          {initials}
        </Text>
      </View>
    );
  };

  const renderContent = () => {
    if (publicAddress) {
      return renderIdenticon();
    }

    if (userName) {
      const initials = getInitials(userName);
      return renderInitials(initials);
    }

    return renderDefaultIcon();
  };

  return renderContent();
};

export default Avatar;
