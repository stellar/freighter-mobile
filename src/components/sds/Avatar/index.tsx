/* eslint-disable react/no-array-index-key */
import { Canvas, Rect } from "@shopify/react-native-skia";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  HSVtoRGB,
  publicKeyToBytes,
  generateMatrix,
  DEFAULT_MATRIX_SIZE,
} from "helpers/stellarIdenticon";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

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
    indicatorSize: 8,
  },
  [AvatarSizes.MEDIUM]: {
    dimension: 36,
    fontSize: 16,
    width: 38,
    height: 38,
    iconSize: 18,
    indicatorSize: 10,
  },
  [AvatarSizes.LARGE]: {
    dimension: 48,
    fontSize: 18,
    width: 50,
    height: 50,
    iconSize: 24,
    indicatorSize: 12,
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
  /** Whether to show selected indicator */
  isSelected?: boolean;
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

interface AvatarWrapperProps {
  size: AvatarSize;
  testID?: string;
  hasBorder?: boolean;
  isSelected?: boolean;
  children: React.ReactNode;
}

const AvatarWrapper: React.FC<AvatarWrapperProps> = ({
  size,
  testID,
  hasBorder = true,
  isSelected = false,
  children,
}) => {
  const { themeColors } = useColors();
  const getSizeClasses = () => {
    const classes: Record<AvatarSize, string> = {
      sm: "w-[26px] h-[26px]",
      md: "w-[38px] h-[38px]",
      lg: "w-[50px] h-[50px]",
    };

    return classes[size];
  };

  const getContainerClasses = () =>
    `relative z-10 ${getSizeClasses()} rounded-full ${
      hasBorder ? "border border-border-primary" : ""
    } ${isSelected ? "border-primary" : ""} bg-background-primary`;

  const getContentClasses = () =>
    "w-full h-full rounded-full overflow-hidden justify-center items-center";

  const getIndicatorClasses = () => {
    const indicatorSizeClasses: Record<AvatarSize, string> = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
      lg: "w-5 h-5",
    };

    return `absolute z-20 -bottom-1 ${indicatorSizeClasses[size]} rounded-full bg-primary justify-center items-center`;
  };

  return (
    <View className={getContainerClasses()} testID={testID}>
      <View className={getContentClasses()}>{children}</View>
      {isSelected && (
        <View className={getIndicatorClasses()} testID={`${testID}-indicator`}>
          <Icon.Check size={8} color={themeColors.base[1]} />
        </View>
      )}
    </View>
  );
};

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
  isSelected = false,
}) => {
  const { themeColors } = useColors();
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

    return (
      <AvatarWrapper
        size={size}
        testID={testID}
        hasBorder={hasBorder}
        isSelected={isSelected}
      >
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
      </AvatarWrapper>
    );
  };

  const renderDefaultIcon = () => (
    <AvatarWrapper
      size={size}
      testID={testID}
      hasBorder={hasBorder}
      isSelected={isSelected}
    >
      <Icon.User01
        size={AVATAR_DIMENSIONS[size].iconSize}
        color={themeColors.text.secondary}
      />
    </AvatarWrapper>
  );

  const renderInitials = (initials: string) => (
    <AvatarWrapper
      size={size}
      testID={testID}
      hasBorder={hasBorder}
      isSelected={isSelected}
    >
      <Text className={`font-bold text-text-secondary ${getTextSizeClass()}`}>
        {initials}
      </Text>
    </AvatarWrapper>
  );

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
