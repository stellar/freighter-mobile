/*
  eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-argument,
  @typescript-eslint/no-unsafe-return
*/

const DEBUG = __DEV__;

const getTimestamp = () => {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const formatArgs = (payload: any) => {
  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return payload;
  }
};

export const debug = (category: string, ...args: any[]) => {
  if (!DEBUG) return;

  const timestamp = getTimestamp();
  const timeTag = `\x1b[32m[${timestamp}]\x1b[0m `;
  const categoryTag = `\x1b[36m[${category}]\x1b[0m`;
  const formattedArgs = args.map(formatArgs);

  // eslint-disable-next-line no-console
  console.log(`${timeTag}${categoryTag}`, ...formattedArgs);
};
