// Note: January has index 0, and December has index 11
export const getMonthLabel = (monthIndex: number) => {
  const date = new Date(2000, monthIndex, 1); // 2000-{month}-01
  // We can change the localization here once Freighter starts supporting
  // languages other than 'en-us'
  const monthLabel = date.toLocaleString("en-us", { month: "long" });
  return monthLabel;
};

export const formatDate = ({
  date,
  includeTime = false,
}: {
  date: string;
  includeTime?: boolean;
}) => {
  const dateObj = new Date(date);

  return new Intl.DateTimeFormat("en-us", {
    dateStyle: "medium",
    ...(includeTime && {
      timeStyle: "short",
    }),
  }).format(dateObj);
};
