import { Canvas, Paint, Rect } from "@shopify/react-native-skia";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import {
  HSVtoRGB,
  publicKeyToBytes,
  generateMatrix,
  DEFAULT_MATRIX_SIZE,
} from "helpers/stellarIdenticon";
import React from "react";
import { View } from "react-native";
import styled from "styled-components/native";

const AVATAR_SIZES = {
  sm: {
    dimension: 24,
    fontSize: 12,
    width: 24,
    height: 24,
    iconSize: 12,
  },
  md: {
    dimension: 36,
    fontSize: 16,
    width: 36,
    height: 36,
    iconSize: 18,
  },
  lg: {
    dimension: 48,
    fontSize: 18,
    width: 48,
    height: 48,
    iconSize: 24,
  },
} as const;

export type AvatarSize = "sm" | "md" | "lg";

const CircleContainer = styled.View<{
  $size: AvatarSize;
}>`
  width: ${({ $size }: { $size: AvatarSize }) => px(AVATAR_SIZES[$size].width)};
  height: ${({ $size }: { $size: AvatarSize }) =>
    px(AVATAR_SIZES[$size].height)};
  border-color: ${THEME.colors.border.default};
  background-color: ${THEME.colors.background.default};
  border-width: 1px;
  border-radius: 50%;
  overflow: hidden;
  justify-content: center;
  align-items: center;
`;

const InitialsText = styled(Text)`
  font-size: ${({ $size }: { $size: AvatarSize }) =>
    fs(AVATAR_SIZES[$size].fontSize)};
  font-weight: bold;
  text-align: center;
  color: ${THEME.colors.text.secondary};
`;

/**
 * Base props for the Avatar component
 * @property {string} size - Size of the avatar: "sm" (24px), "md" (36px), or "lg" (48px)
 */
export interface AvatarBaseProps {
  /** Avatar size */
  size: AvatarSize;
  testID?: string;
}

/**
 * Props for Avatar with a Stellar address
 * @property {string} publicAddress - Public Stellar address to generate identicon from
 * @example
 * // Avatar with Stellar address
 * <Avatar
 *   size="md"
 *   publicAddress="GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM"
 * />
 */
export interface AvatarStellarAddressProps {
  /** Public Stellar address */
  publicAddress: string;
  userName?: undefined;
}

/**
 * Props for Avatar with a username
 * @property {string} userName - User name to display initials from
 * @example
 * // Avatar with user name (shows initials)
 * <Avatar
 *   size="md"
 *   userName="John Doe"
 * />
 */
export interface AvatarUserNameProps {
  /** User name for initials */
  userName: string;
  publicAddress?: undefined;
}

/**
 * Props for the Avatar component
 *
 * The Avatar component can display:
 * 1. A unique identicon based on a public Stellar address
 * 2. User initials based on a userName
 * 3. A default user icon if neither is provided
 *
 * @example
 * // Default avatar (user icon)
 * <Avatar size="md" />
 *
 * // Avatar with Stellar address
 * <Avatar
 *   size="md"
 *   publicAddress="GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM"
 * />
 *
 * // Avatar with user name (shows initials)
 * <Avatar
 *   size="md"
 *   userName="John Doe"
 * />
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
 * - A Stellar identicon for a public address
 * - Initials for a userName
 * - A default user icon when no data is provided
 *
 * This component adapts to different sizes: "sm" (24px), "md" (36px), or "lg" (48px)
 *
 * @param {AvatarProps} props - The component props
 * @returns {React.ReactElement} The rendered Avatar component
 *
 * @example
 * // Default avatar
 * <Avatar size="md" />
 *
 * @example
 * // Avatar with Stellar address
 * <Avatar
 *   size="md"
 *   publicAddress="GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST5TVOM"
 * />
 *
 * @example
 * // Avatar with user name (shows initials)
 * <Avatar
 *   size="md"
 *   userName="John Doe"
 * />
 */
export const Avatar: React.FC<AvatarProps> = ({
  size,
  publicAddress,
  userName,
  testID,
}) => {
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
    const color = HSVtoRGB(bytes[0] / 255, 0.7, 0.8);
    const rgbColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

    const getDimension = () => AVATAR_SIZES[size].dimension;

    const dimension = getDimension();

    // Increase padding to 20% of dimension for more margin inside the circle
    const padding = Math.max(2, Math.floor(dimension * 0.2));
    const availableSpace = dimension - padding * 2;

    // First calculate perfect integer cell size
    const perfectCellSize = Math.floor(availableSpace / DEFAULT_MATRIX_SIZE);
    // Then recalculate available space to ensure perfect alignment
    const adjustedAvailableSpace = perfectCellSize * DEFAULT_MATRIX_SIZE;

    // Draw one cell larger to eliminate all gaps
    const adjustedCellSize = perfectCellSize + 1;

    return (
      <CircleContainer $size={size} testID={testID}>
        <View
          style={{
            width: dimension,
            height: dimension,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Canvas
            style={{
              width: adjustedAvailableSpace,
              height: adjustedAvailableSpace,
            }}
          >
            {matrix.map((row, rowIndex) =>
              row.map(
                (cell, colIndex) =>
                  cell && (
                    <Rect
                      // eslint-disable-next-line react/no-array-index-key
                      key={`cell-${rowIndex}-${colIndex}`}
                      x={perfectCellSize * colIndex}
                      y={perfectCellSize * rowIndex}
                      width={adjustedCellSize}
                      height={adjustedCellSize}
                    >
                      <Paint color={rgbColor} />
                    </Rect>
                  ),
              ),
            )}
          </Canvas>
        </View>
      </CircleContainer>
    );
  };

  const renderDefaultIcon = () => (
    <CircleContainer $size={size} testID={testID}>
      <Icon.User01
        size={AVATAR_SIZES[size].iconSize}
        color={THEME.colors.text.secondary}
      />
    </CircleContainer>
  );

  const renderContent = () => {
    if (publicAddress) {
      return renderIdenticon();
    }

    if (userName) {
      const initials = getInitials(userName);
      return (
        <CircleContainer $size={size} testID={testID}>
          <InitialsText $size={size}>{initials}</InitialsText>
        </CircleContainer>
      );
    }

    return renderDefaultIcon();
  };

  return renderContent();
};

export default Avatar;
