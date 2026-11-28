import { getDeviceLanguage } from "helpers/localeUtils";

/**
 * The date on an Activity row, in the device's language: "Aug 28" within the
 * current year, "Aug 28, 2025" outside it, where the day alone is ambiguous.
 * Empty for an unreadable date.
 */
export const formatActivityDate = (
  occurredAt: string,
  now: Date = new Date(),
): string => {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(getDeviceLanguage(), {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
};
