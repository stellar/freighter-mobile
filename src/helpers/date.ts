import { getDeviceLanguage } from "helpers/localeUtils";

// Note: January has index 0, and December has index 11
export const getMonthLabel = (monthIndex: number, locale?: string) => {
  const date = new Date(2000, monthIndex, 1); // 2000-{month}-01
  // Use current locale for month labels
  const monthLabel = date.toLocaleString(locale ?? getDeviceLanguage(), {
    month: "long",
  });
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

  return new Intl.DateTimeFormat(locale ?? getDeviceLanguage(), {
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
    return dateObj.toLocaleDateString(getDeviceLanguage(), {
      month: "short",
      day: "numeric",
    });
  }

  // Comprehensive format for transaction details: "Dec 13, 2023 · 2:30pm"
  const formattedDate = dateObj.toLocaleDateString(getDeviceLanguage(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = dateObj
    .toLocaleTimeString(getDeviceLanguage(), {
      hour: "numeric",
      minute: "2-digit",
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

/**
 * Date/time formatters for the v2 history pipeline.
 *
 * Ported from the browser extension's popup/helpers/date.ts. Unlike the
 * extension (English-only, so it pins "en-US"), each formatter here defaults
 * its locale to the device language via `getDeviceLanguage()`, matching the
 * rest of this module (see `getMonthLabel`/`formatDate` above) — this app
 * ships `en` and `pt`, so a hard-pinned locale would show English month and
 * time strings inside a Portuguese app. An optional trailing `locale`
 * parameter still allows a caller to override the default explicitly.
 *
 * Formatters take an ISO timestamp string (what the history APIs return) and
 * render "" for an unparseable one, so a bad value can't surface as
 * "Invalid Date". `getMonthYearKey` is the exception — it is a grouping key, not
 * display text, and documents its own behavior.
 */

const parse = (createdAt: string) => {
  const date = new Date(Date.parse(createdAt));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "2024-05-27T14:33:00Z" → "May 27" — history row dates. */
export const formatMonthDay = (createdAt: string, locale?: string) => {
  const date = parse(createdAt);
  if (!date) {
    return "";
  }
  return date.toLocaleDateString(locale ?? getDeviceLanguage(), {
    month: "short",
    day: "numeric",
  });
};

/** "2024-04-08T14:33:00Z" → "Apr 8, 2024" */
export const formatMonthDayYear = (createdAt: string, locale?: string) => {
  const date = parse(createdAt);
  if (!date) {
    return "";
  }
  return date.toLocaleDateString(locale ?? getDeviceLanguage(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** "2024-04-08T14:33:00Z" → "2:33 PM" */
export const formatClockTime = (createdAt: string, locale?: string) => {
  const date = parse(createdAt);
  if (!date) {
    return "";
  }
  return date.toLocaleTimeString(locale ?? getDeviceLanguage(), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/** "2024-04-08T14:33:00Z" → "Apr 8, 2024 · 2:33pm" — detail sheet header. */
export const formatDetailTimestamp = (createdAt: string, locale?: string) => {
  const day = formatMonthDayYear(createdAt, locale);
  if (!day) {
    return "";
  }
  const time = formatClockTime(createdAt, locale)
    .replace(/\s/g, "")
    .toLowerCase();
  return `${day} · ${time}`;
};

/**
 * Month index → full month name, for the history list's month headers.
 * Note: January is 0, December is 11.
 *
 * Callers parse the index out of a `getMonthYearKey` string, so an unusable key
 * arrives here as NaN — label nothing rather than a misleading "January".
 */
export const formatMonthLabel = (monthIndex: number, locale?: string) => {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return "";
  }
  return new Date(2000, monthIndex, 1).toLocaleString(
    locale ?? getDeviceLanguage(),
    {
      month: "long",
    },
  );
};

/**
 * "2024-04-08T14:33:00Z" → "3:2024" — the key both history hooks group rows by,
 * and which the month headers split back apart for `formatMonthLabel`.
 *
 * An unparseable timestamp yields "NaN:NaN" (all such rows group together),
 * which `formatMonthLabel` renders as no header at all. Deliberately not "":
 * that parses back to month 0 and would print a confident "January".
 */
export const getMonthYearKey = (createdAt: string) => {
  const date = new Date(Date.parse(createdAt));
  return `${date.getMonth()}:${date.getFullYear()}`;
};
