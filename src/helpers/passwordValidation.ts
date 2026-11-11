import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";

/**
 * Whether a password's length is within the bounds the wallet accepts. The
 * same rule applies when choosing, confirming and entering the password.
 */
export const isValidPasswordLength = (password: string): boolean =>
  password.length >= PASSWORD_MIN_LENGTH &&
  password.length <= PASSWORD_MAX_LENGTH;
