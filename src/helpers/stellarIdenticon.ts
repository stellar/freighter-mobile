/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
/**
 * Helper functions for Stellar identicon generation
 */

const DEFAULT_MATRIX_SIZE = 7;

// Decode base32 string
const decodeBase32 = (input: string): number[] => {
  const keyString = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const charmap: Record<string, number> = {};
  keyString.split("").forEach((c, i) => {
    charmap[c] = i;
  });

  const buf: number[] = [];
  let shift = 8;
  let carry = 0;

  input
    .toUpperCase()
    .split("")
    .forEach((char) => {
      const symbol = charmap[char] & 0xff;

      shift -= 5;
      if (shift > 0) {
        carry |= symbol << shift;
      } else if (shift < 0) {
        buf.push(carry | (symbol >> -shift));
        shift += 8;
        carry = (symbol << shift) & 0xff;
      } else {
        buf.push(carry | symbol);
        shift = 8;
        carry = 0;
      }
    });

  if (shift !== 8 && carry !== 0) {
    buf.push(carry);
  }

  return buf;
};

// Convert public key to bytes
const publicKeyToBytes = (publicKey: string): number[] => {
  const decoded = decodeBase32(publicKey);
  return decoded.slice(2, 16); // Take 16 meaningful bytes from raw pub key
};

// Generate empty matrix
const generateEmptyMatrix = (width: number, height: number): boolean[][] => {
  const matrix: boolean[][] = [];

  for (let i = 0; i < height; i++) {
    const row: boolean[] = [];
    for (let j = 0; j < width; j++) {
      row.push(false);
    }
    matrix.push(row);
  }

  return matrix;
};

// Get bit at position
const getBit = (position: number, bytes: number[]): number =>
  (bytes[Math.floor(position / 8)] & (1 << (7 - (position % 8)))) === 0 ? 0 : 1;

// Generate matrix
const generateMatrix = (bytes: number[], symmetry: boolean): boolean[][] => {
  const width = DEFAULT_MATRIX_SIZE;
  const height = DEFAULT_MATRIX_SIZE;
  const matrix = generateEmptyMatrix(width, height);

  const columnsToCalculation = symmetry ? Math.ceil(width / 2) : width;
  for (let column = 0; column < columnsToCalculation; column++) {
    for (let row = 0; row < height; row++) {
      if (getBit(column + row * columnsToCalculation, bytes.slice(1))) {
        matrix[row][column] = true;

        if (symmetry) {
          matrix[row][width - column - 1] = true;
        }
      }
    }
  }

  return matrix;
};

/**
 * Converts an HSV color value to RGB.
 *
 * @param h - Hue component, between 0 and 1.
 * @param s - Saturation component, between 0 and 1.
 * @param v - Value (brightness) component, between 0 and 1.
 * @returns An object with r, g, b properties (0-255).
 */
const HSVtoRGB = (
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } => {
  let r: number;
  let g: number;
  let b: number;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = 0;
      g = 0;
      b = 0;
  }

  // Convert the values to the 0-255 range and round them
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

export { publicKeyToBytes, generateMatrix, HSVtoRGB, DEFAULT_MATRIX_SIZE };
