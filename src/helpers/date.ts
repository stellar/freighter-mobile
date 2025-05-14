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
