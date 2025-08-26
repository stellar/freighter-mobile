export const toAsync =
  <T, R>(fn: (...args: T[]) => R): ((...args: T[]) => Promise<R>) =>
  (...args: T[]) =>
    Promise.resolve(fn(...args));
