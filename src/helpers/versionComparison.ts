import { Comparison } from "config/constants";

/**
 * Version comparison utilities for app update checking
 */

/**
 * Compares two semantic version strings
 * @param version1 - First version to compare (e.g., "1.2.3")
 * @param version2 - Second version to compare (e.g., "1.2.4")
 * @returns Comparison.LOWER if version1 < version2, SAME if equal, GREATER if version1 > version2
 */
export const compareVersions = (
  version1: string,
  version2: string,
): Comparison => {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  // Ensure both arrays have the same length by padding with zeros
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  while (v1Parts.length < maxLength) v1Parts.push(0);
  while (v2Parts.length < maxLength) v2Parts.push(0);

  for (let i = 0; i < maxLength; i++) {
    if (v1Parts[i] < v2Parts[i]) return Comparison.LOWER;
    if (v1Parts[i] > v2Parts[i]) return Comparison.GREATER;
  }

  return Comparison.SAME;
};

/**
 * Checks if the current app version is below the target version
 * @param currentVersion - Current app version
 * @param targetVersion - Target version to compare against
 * @returns true if current version is below target version
 */
export const isVersionBelow = (
  currentVersion: string,
  targetVersion: string,
): boolean =>
  compareVersions(currentVersion, targetVersion) === Comparison.LOWER;

/**
 * Checks if two versions have different protocol versions (third number)
 * @param currentVersion - Current app version (e.g., "1.5.23")
 * @param targetVersion - Target version to compare against (e.g., "1.6.24")
 * @returns true if protocol versions are different
 */
export const isDifferentProtocol = (
  currentVersion: string,
  targetVersion: string,
): boolean => {
  const currentParts = currentVersion.split(".").map(Number);
  const targetParts = targetVersion.split(".").map(Number);

  // Ensure both have at least 3 parts (major.minor.protocol)
  const currentProtocol = currentParts[2] || 0;
  const targetProtocol = targetParts[2] || 0;

  return currentProtocol !== targetProtocol;
};
