import { Canvas, Rect } from "@shopify/react-native-skia";
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
    width: 26,
    height: 26,
    iconSize: 12,
  },
  md: {
    dimension: 36,
    fontSize: 16,
    width: 38,
    height: 38,
    iconSize: 18,
  },
  lg: {
    dimension: 40,
    fontSize: 16,
    width: 40,
    height: 40,
    iconSize: 16,
  },
  xl: {
    dimension: 48,
    fontSize: 18,
    width: 50,
    height: 50,
    iconSize: 24,
  },
} as const;

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const CircleContainer = styled.View<{
  $size: AvatarSize;
  $hasBorder: boolean;
}>`
  width: ${({ $size }: { $size: AvatarSize }) => px(AVATAR_SIZES[$size].width)};
  height: ${({ $size }: { $size: AvatarSize }) =>
    px(AVATAR_SIZES[$size].height)};
  border-color: ${({ $hasBorder }: { $hasBorder: boolean }) =>
    $hasBorder ? THEME.colors.border.default : "transparent"};
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
  hasBorder?: boolean;
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
 * - A Stellar identicon based on a public Stellar address
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
  hasBorder = true,
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

    // Increase padding to 25% of dimension for more margin inside the circle
    const padding = Math.max(2, Math.floor(dimension * 0.2));
    const availableSpace = dimension - padding * 2;

    // Use integer math to ensure perfect symmetry
    const cellSize = Math.floor(availableSpace / DEFAULT_MATRIX_SIZE);
    const totalSize = cellSize * DEFAULT_MATRIX_SIZE;

    // Center the matrix in the available space
    const offset = (availableSpace - totalSize) / 2;

    return (
      <CircleContainer $size={size} $hasBorder={hasBorder} testID={testID}>
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
              width: availableSpace,
              height: availableSpace,
              transform: [
                { scale: AVATAR_SIZES[size].iconSize / availableSpace },
              ],
            }}
          >
            {matrix.map((row, rowIndex) =>
              row.map(
                (cell, colIndex) =>
                  cell && (
                    <Rect
                      // eslint-disable-next-line react/no-array-index-key
                      key={`cell-${rowIndex}-${colIndex}`}
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
      </CircleContainer>
    );
  };

  const renderDefaultIcon = () => (
    <CircleContainer $size={size} $hasBorder={hasBorder} testID={testID}>
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
        <CircleContainer $size={size} $hasBorder={hasBorder} testID={testID}>
          <InitialsText $size={size}>{initials}</InitialsText>
        </CircleContainer>
      );
    }

    return renderDefaultIcon();
  };

  return renderContent();
};

export default Avatar;
