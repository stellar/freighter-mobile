/* eslint-disable no-console */
import * as Sentry from "@sentry/react-native";
import { debug } from "helpers/debug";
import { isDev, isE2ETest } from "helpers/isEnv";

/**
 * Log levels supported by the logger
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Normalize any error type to a proper Error object for Sentry
 * This handles strings, objects, React Native events, and unknown types
 *
 * this method was built with some existing errors from the project as reference
 * e.g.: NativeEventError, NetworkError, PromiseRejectionError, etc.
 * and to make it more robust and cover other possible error types
 * we added some other from the stack overflow and some from cursor suggestions
 *
 * @param error - The error to normalize (can be any type)
 * @returns A proper Error object suitable for Sentry captureException
 *
 * @example
 * ```typescript
 * // Error objects (preserved as-is)
 * normalizeError(new Error("Something went wrong"))
 *
 * // Strings (converted to Error)
 * normalizeError("Network timeout")
 *
 * // Objects with message property
 * normalizeError({ message: "Validation failed" })
 *
 * // Objects with nested error property
 * normalizeError({ error: new Error("Nested error") })
 *
 * // React Native synthetic events
 * normalizeError({ nativeEvent: { error: "Image load failed" } })
 *
 * // Network errors
 * normalizeError({ code: "NETWORK_ERROR", message: "Request failed" })
 *
 * // Promise rejections
 * normalizeError({ reason: "Promise rejected", stack: "..." })
 *
 * // Native module errors
 * normalizeError({ nativeErrorCode: "E_CAMERA_PERMISSION", nativeErrorMessage: "Permission denied" })
 *
 * // Unknown objects (JSON stringified)
 * normalizeError({ code: 500, details: "Server error" })
 *
 * // Completely unknown types (fallback)
 * normalizeError(undefined) // Returns "An unknown error occurred"
 * ```
 */
export const normalizeError = (error: unknown): Error => {
  // If it's already an Error object, return it
  if (error instanceof Error) {
    return error;
  }

  // If it's a string, create an Error with that message
  if (typeof error === "string") {
    return new Error(error);
  }

  // If it's null or undefined, return a generic error
  if (error === null || error === undefined) {
    return new Error("An unknown error occurred");
  }

  // If it's not an object, try to convert to string
  if (typeof error !== "object") {
    return new Error(String(error));
  }

  // React Native synthetic events (Image, Video, etc.)
  if ("nativeEvent" in error) {
    const { nativeEvent } = error as { nativeEvent: unknown };

    if (nativeEvent && typeof nativeEvent === "object") {
      // Handle different types of native events
      if ("error" in nativeEvent) {
        const { error: eventError } = nativeEvent as { error: unknown };

        if (typeof eventError === "string") {
          return new Error(`Native event error: ${eventError}`);
        }

        if (eventError instanceof Error) {
          return eventError;
        }
      }

      // Handle network errors in native events
      if ("code" in nativeEvent && "message" in nativeEvent) {
        const { code, message } = nativeEvent as {
          code: unknown;
          message: unknown;
        };

        return new Error(`Network error ${String(code)}: ${String(message)}`);
      }
    }

    return new Error("React Native event error");
  }

  // Network errors (fetch, axios, etc.)
  if ("code" in error || "status" in error || "statusCode" in error) {
    const errorObj = error as Record<string, unknown>;
    const code = errorObj.code || errorObj.status || errorObj.statusCode;
    const message =
      errorObj.message || errorObj.error || "Network request failed";

    return new Error(`Network error ${String(code)}: ${String(message)}`);
  }

  // Promise rejection errors
  if ("reason" in error) {
    const { reason } = error as { reason: unknown };

    if (reason instanceof Error) {
      return reason;
    }

    if (typeof reason === "string") {
      return new Error(`Promise rejected: ${reason}`);
    }

    return new Error(`Promise rejected: ${JSON.stringify(reason)}`);
  }

  // Native module errors (camera, permissions, etc.)
  if ("nativeErrorCode" in error || "nativeErrorMessage" in error) {
    const errorObj = error as Record<string, unknown>;
    const code = errorObj.nativeErrorCode || "UNKNOWN";
    const message = errorObj.nativeErrorMessage || "Native module error";

    return new Error(`Native module error ${String(code)}: ${String(message)}`);
  }

  // React component rendering errors
  if ("componentStack" in error || "componentName" in error) {
    const errorObj = error as Record<string, unknown>;
    const componentName = errorObj.componentName || "Unknown component";
    const message = errorObj.message || "Component rendering error";

    return new Error(
      `React component error in ${String(componentName)}: ${String(message)}`,
    );
  }

  // Objects with message property (most common case)
  if ("message" in error) {
    const { message } = error as { message: unknown };

    if (typeof message === "string") {
      return new Error(message);
    }
  }

  // Objects with error property (nested errors)
  if ("error" in error) {
    const { error: nestedError } = error as { error: unknown };

    if (nestedError instanceof Error) {
      return nestedError;
    }
    if (typeof nestedError === "string") {
      return new Error(nestedError);
    }

    // Recursively normalize nested errors
    return normalizeError(nestedError);
  }

  // Objects with description property (some APIs use this)
  if ("description" in error) {
    const { description } = error as { description: unknown };

    if (typeof description === "string") {
      return new Error(description);
    }
  }

  // Objects with details property
  if ("details" in error) {
    const { details } = error as { details: unknown };

    if (typeof details === "string") {
      return new Error(details);
    }
  }

  // Try to extract meaningful information from the object
  const errorObj = error as Record<string, unknown>;
  const meaningfulProps = [
    "message",
    "error",
    "description",
    "details",
    "reason",
    "cause",
  ];

  const meaningfulProp = meaningfulProps.find(
    (prop) => prop in errorObj && typeof errorObj[prop] === "string",
  );

  if (meaningfulProp) {
    return new Error(errorObj[meaningfulProp] as string);
  }

  // Try to stringify the error for debugging
  try {
    const errorString = JSON.stringify(error, null, 2);

    return new Error(`Unknown error object: ${errorString}`);
  } catch {
    // If JSON.stringify fails, use toString
    try {
      return new Error(`Unknown error: ${String(error)}`);
    } catch {
      return new Error("An unknown error occurred");
    }
  }
};

/**
 * Interface for logger adapters
 */
export interface LoggerAdapter {
  debug: (context: string, message: string, ...args: unknown[]) => void;
  info: (context: string, message: string, ...args: unknown[]) => void;
  warn: (context: string, message: string, ...args: unknown[]) => void;
  error: (
    context: string,
    message: string,
    error: unknown,
    ...args: unknown[]
  ) => void;
}

/**
 * Default console adapter implementation
 */
const consoleAdapter: LoggerAdapter = {
  debug: (context: string, message: string, ...args: unknown[]) => {
    if (isDev) {
      debug(`[${context}] ${message}`, ...args);
    }
  },
  info: (context: string, message: string, ...args: unknown[]) => {
    console.info(`[${context}] ${message}`, ...args);
  },
  warn: (context: string, message: string, ...args: unknown[]) => {
    console.warn(`[${context}] ${message}`, ...args);
  },
  error: (
    context: string,
    message: string,
    error: unknown,
    ...args: unknown[]
  ) => {
    const normalizedError = normalizeError(error);

    console.error(`[${context}] ${message}`, normalizedError, ...args);
  },
};

/**
 * Logger class that implements the adapter pattern
 */
class Logger {
  private adapter: LoggerAdapter;

  private static instance: Logger;

  private constructor(adapter: LoggerAdapter = consoleAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get the singleton instance of the logger
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set a new adapter for the logger
   * @param adapter - The new adapter to use
   */
  setAdapter(adapter: LoggerAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Log a debug message
   * @param context - The context of the message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(context: string, message: string, ...args: unknown[]): void {
    this.adapter.debug(context, message, ...args);
  }

  /**
   * Log an info message
   * @param context - The context of the message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(context: string, message: string, ...args: unknown[]): void {
    this.adapter.info(context, message, ...args);
  }

  /**
   * Log a warning message
   * @param context - The context of the message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(context: string, message: string, ...args: unknown[]): void {
    this.adapter.warn(context, message, ...args);
  }

  /**
   * Log an error message
   * @param context - The context of the message
   * @param message - The message to log
   * @param error - The error to log (can be any type, will be normalized)
   * @param args - Additional arguments to log
   */
  error(
    context: string,
    message: string,
    error: unknown,
    ...args: unknown[]
  ): void {
    this.adapter.error(context, message, error, ...args);
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();

/**
 * Sanitize data to remove potential PII before sending to Sentry
 * Add or remove fields on the list if necessary
 */
export const sanitizeLogData = (data: unknown): unknown => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sanitized = { ...(data as Record<string, unknown>) };

  // Remove common PII fields
  const piiFields = [
    "email",
    "phone",
    "address",
    "name",
    "firstName",
    "lastName",
    "username",
    "userId",
    "accountId",
    "privateKey",
    "seed",
    "mnemonic",
    "password",
    "token",
    "jwt",
    "session",
    "ip",
    "ipAddress",
    "location",
    "coordinates",
    "auth",
    "key",
    "secret",
    "secretKey",
    "recovery",
    "recoveryPhrase",
    "mnemonicPhrase",
  ];

  const sanitizedKeys = Object.keys(sanitized);
  const piiFieldsLower = piiFields.map((field) => field.toLowerCase());

  sanitizedKeys.forEach((key) => {
    if (piiFieldsLower.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    }
  });

  return sanitized;
};

/**
 * Sentry adapter implementation for production logging
 */
const sentryAdapter: LoggerAdapter = {
  debug: () => {},
  info: () => {},
  warn: (context: string, message: string) => {
    // Skip Sentry during e2e tests
    if (isE2ETest) {
      return;
    }
    // capture a message for warning level
    Sentry.captureMessage(`[${context}] ${message}`, "warning");
  },
  error: (
    context: string,
    message: string,
    error: unknown,
    ...args: unknown[]
  ) => {
    // Skip Sentry during e2e tests
    if (isE2ETest) {
      return;
    }
    const normalizedError = normalizeError(error);

    // capture the error with context and sanitized extra data
    Sentry.captureException(normalizedError, {
      tags: { context },
      extra: args.length > 0 ? { args: sanitizeLogData(args) } : undefined,
    });
  },
};

/**
 * Combined adapter that logs to both console (in development) and Sentry
 */
const combinedAdapter: LoggerAdapter = {
  debug: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.debug(context, message, ...args);
  },
  info: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.info(context, message, ...args);
  },
  warn: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.warn(context, message, ...args);
    // Skip Sentry during e2e tests
    if (!isE2ETest) {
      sentryAdapter.warn(context, message, ...args);
    }
  },
  error: (
    context: string,
    message: string,
    error: unknown,
    ...args: unknown[]
  ) => {
    consoleAdapter.error(context, message, error, ...args);
    // Skip Sentry during e2e tests
    if (!isE2ETest) {
      sentryAdapter.error(context, message, error, ...args);
    }
  },
};

/**
 * Initialize Sentry integration for the logger
 * This should be called after Sentry.init() in the application bootstrap
 */
export const initializeSentryLogger = (): void => {
  // Use combined adapter for development (console + Sentry for Spotlight),
  // Sentry only for production
  logger.setAdapter(isDev ? combinedAdapter : sentryAdapter);
};
