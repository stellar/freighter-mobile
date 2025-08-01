// Note: January has index 0, and December has index 11
export const getMonthLabel = (monthIndex: number, locale?: string) => {
  const date = new Date(2000, monthIndex, 1); // 2000-{month}-01
  // We can change the localization here once Freighter starts supporting
  // languages other than 'en-us'
  const monthLabel = date.toLocaleString(locale ?? "en-us", { month: "long" });
  return monthLabel;
};

export const formatDate = ({
  date,
  includeTime = false,
  locale,
}: {
  date: string;
  includeTime?: boolean;
  locale?: string;
}) => {
  const dateObj = new Date(date);

  return new Intl.DateTimeFormat(locale ?? "en-us", {
    dateStyle: "medium",
    ...(includeTime && {
      timeStyle: "short",
    }),
  }).format(dateObj);
};

/**
 * Formats transaction date for display in transaction contexts
 * Can be used with or without time component
 * @param createdAt - ISO date string or undefined for current time
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date string
 */
export const formatTransactionDate = (
  createdAt?: string,
  includeTime: boolean = true,
): string => {
  let dateObj: Date;

  if (createdAt) {
    dateObj = new Date(createdAt);
  } else {
    dateObj = new Date();
  }

  if (!includeTime) {
    // Simple format for history lists: "Dec 13"
    return dateObj.toDateString().split(" ").slice(1, 3).join(" ");
  }

  // Comprehensive format for transaction details: "Dec 13, 2023 · 2:30pm"
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = dateObj
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  return `${formattedDate} · ${formattedTime}`;
};

/**
 * Formats a timestamp as relative time (e.g., "just now", "5m ago", "2h ago")
 * It doesn't need to be translated as it's only being used for DEBUGGING information
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted relative time string
 */
export const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};
