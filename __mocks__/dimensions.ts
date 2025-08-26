/**
 * Mock implementation of the dimensions helper for tests
 */

export const deviceAspectRatio = 0.5; // Mock aspect ratio

/**
 * Mock implementation of pxValue that returns the input value
 */
export function pxValue(designValue: number): number {
  return designValue;
}

/**
 * Mock implementation of px that returns the input value with 'px' suffix
 */
export function px(designValue: number): string {
  return `${designValue}px`;
}

/**
 * Mock implementation of fsValue that returns the input value
 */
export function fsValue(designFontSize: number): number {
  return designFontSize;
}

/**
 * Mock implementation of fs that returns the input value with 'px' suffix
 */
export function fs(designFontSize: number): string {
  return `${designFontSize}px`;
}

/**
 * Mock implementation of calculateEdgeSpacing
 */
export const calculateEdgeSpacing = (
  baseSpacing: number,
  options?: { multiplier?: number; toNumber?: boolean },
): string | number => {
  const { multiplier = 1, toNumber = false } = options || {};
  const scaledValue = baseSpacing * multiplier;

  return toNumber ? scaledValue : `${scaledValue}px`;
};

export const toPercent = (percentNumber: number): string => `${percentNumber}%`;
