/* eslint-disable react/no-array-index-key */
import { Canvas } from "@shopify/react-native-skia";
import { MarbleAvatar } from "components/sds/Avatar/MarbleAvatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

// Constants for sizes
export const AvatarSizes = {
  SMALL: "sm",
  MEDIUM: "md",
  LARGE: "lg",
  EXTRA_LARGE: "xl",
  DOUBLE_EXTRA_LARGE: "xxl",
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
    dimension: 40,
    fontSize: 16,
    width: 40,
    height: 40,
    iconSize: 16,
    indicatorSize: 10,
  },
  [AvatarSizes.EXTRA_LARGE]: {
    dimension: 48,
    fontSize: 18,
    width: 50,
    height: 50,
    iconSize: 24,
    indicatorSize: 12,
  },
  [AvatarSizes.DOUBLE_EXTRA_LARGE]: {
    dimension: 74,
    fontSize: 24,
    width: 74,
    height: 74,
    iconSize: 32,
    indicatorSize: 16,
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
  /** Whether to show background */
  hasBackground?: boolean;
  /** Whether to show on dark background */
  hasDarkBackground?: boolean;
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
  hasBackground?: boolean;
  hasDarkBackground?: boolean;
  isSelected?: boolean;
  children: React.ReactNode;
}

const AvatarWrapper: React.FC<AvatarWrapperProps> = ({
  size,
  testID,
  hasBorder = false,
  hasBackground = true,
  hasDarkBackground = false,
  isSelected = false,
  children,
}) => {
  const { themeColors } = useColors();
  const getSizeClasses = () => {
    const classes: Record<AvatarSize, string> = {
      sm: "w-[26px] h-[26px]",
      md: "w-[38px] h-[38px]",
      lg: "w-[40px] h-[40px]",
      xl: "w-[50px] h-[50px]",
      xxl: "w-[74px] h-[74px]",
    };

    return classes[size];
  };

  const getContainerClasses = () => {
    let bgClass = "";
    if (hasBackground) {
      bgClass = "bg-background-tertiary";
    }
    if (hasDarkBackground) {
      bgClass = "bg-background-primary";
    }

    return `relative z-10 ${getSizeClasses()} rounded-full ${
      hasBorder ? "border border-border-primary" : ""
    } ${isSelected ? "border-primary" : ""} ${bgClass}`;
  };

  const getContentClasses = () =>
    "w-full h-full rounded-full overflow-hidden justify-center items-center";

  const getIndicatorClasses = () => {
    const indicatorSizeClasses: Record<AvatarSize, string> = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
      lg: "w-5 h-5",
      xl: "w-6 h-6",
      xxl: "w-6 h-6",
    };

    return `absolute z-20 -bottom-1 right-0 ${indicatorSizeClasses[size]} rounded-full bg-primary justify-center items-center`;
  };

  return (
    <View className={getContainerClasses()} testID={testID}>
      <View className={getContentClasses()}>{children}</View>
      {isSelected && (
        <View className={getIndicatorClasses()} testID={`${testID}-indicator`}>
          {/* The badge is bg-primary in both schemes, so the check is white
              in both. An inverting token would go black on blue in light. */}
          <Icon.Check size={8} color={themeColors.white} />
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
  hasBorder = false,
  hasBackground = true,
  hasDarkBackground = false,
  isSelected = false,
}) => {
  const { themeColors } = useColors();

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

    // The drawing fills the content area, which a border shrinks by 1px a side.
    const drawingSize = AVATAR_DIMENSIONS[size].width - (hasBorder ? 2 : 0);
    // On iOS, Skia truncates its view's bounds to whole points, and layout
    // pixel-snapping at a fractional offset (the home header) makes a 40pt
    // canvas 39.67pt, so its last point row went missing. A canvas 1pt
    // larger, pinned top-left and clipped by the content area, always keeps
    // the whole drawing.
    const canvasSize = drawingSize + 1;

    return (
      <AvatarWrapper
        size={size}
        testID={testID}
        hasBorder={hasBorder}
        isSelected={isSelected}
        hasBackground={hasBackground}
        hasDarkBackground={hasDarkBackground}
      >
        <Canvas
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: canvasSize,
            height: canvasSize,
          }}
        >
          <MarbleAvatar publicAddress={publicAddress} size={drawingSize} />
        </Canvas>
      </AvatarWrapper>
    );
  };

  const renderDefaultIcon = () => (
    <AvatarWrapper
      size={size}
      testID={testID}
      hasBorder={hasBorder}
      isSelected={isSelected}
      hasBackground={hasBackground}
      hasDarkBackground={hasDarkBackground}
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
      hasBackground={hasBackground}
      hasDarkBackground={hasDarkBackground}
    >
      <Text
        bold
        secondary
        size={size === AvatarSizes.DOUBLE_EXTRA_LARGE ? "xl" : size}
      >
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
