/**
 * Whether a Horizon error is a 404, i.e. the account does not exist.
 *
 * @param {unknown} error - What a Horizon call threw
 * @returns {boolean} True for a 404 response
 */
export const isHorizonNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  typeof error.response === "object" &&
  error.response !== null &&
  "status" in error.response &&
  (error.response as { status: unknown }).status === 404;
