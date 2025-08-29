/* eslint-disable no-console */
import * as Sentry from "@sentry/react-native";
import { debug } from "helpers/debug";

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
 * Interface for logger adapters
 */
export interface LoggerAdapter {
  debug: (context: string, message: string, ...args: unknown[]) => void;
  info: (context: string, message: string, ...args: unknown[]) => void;
  warn: (context: string, message: string, ...args: unknown[]) => void;
  error: (context: string, message: string, ...args: unknown[]) => void;
}

/**
 * Default console adapter implementation
 */
const consoleAdapter: LoggerAdapter = {
  debug: (context: string, message: string, ...args: unknown[]) => {
    if (__DEV__) {
      debug(`[${context}] ${message}`, ...args);
    }
  },
  info: (context: string, message: string, ...args: unknown[]) => {
    console.info(`[${context}] ${message}`, ...args);
  },
  warn: (context: string, message: string, ...args: unknown[]) => {
    console.warn(`[${context}] ${message}`, ...args);
  },
  error: (context: string, message: string, ...args: unknown[]) => {
    console.error(`[${context}] ${message}`, ...args);
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
   * @param args - Additional arguments to log
   */
  error(context: string, message: string, ...args: unknown[]): void {
    this.adapter.error(context, message, ...args);
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
const sanitizeLogData = (data: unknown): unknown => {
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
  ];

  piiFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  });

  return sanitized;
};

/**
 * Sentry adapter implementation for production logging
 */
const sentryAdapter: LoggerAdapter = {
  debug: (context: string, message: string, ...args: unknown[]) => {
    // Only add debug breadcrumbs in development
    if (__DEV__) {
      Sentry.addBreadcrumb({
        level: "debug",
        message: `[${context}] ${message}`,
        data: args.length > 0 ? { args: sanitizeLogData(args) } : undefined,
        category: context,
      });
    }
  },
  info: (context: string, message: string, ...args: unknown[]) => {
    Sentry.addBreadcrumb({
      level: "info",
      message: `[${context}] ${message}`,
      data: args.length > 0 ? { args: sanitizeLogData(args) } : undefined,
      category: context,
    });
  },
  warn: (context: string, message: string, ...args: unknown[]) => {
    Sentry.addBreadcrumb({
      level: "warning",
      message: `[${context}] ${message}`,
      data: args.length > 0 ? { args: sanitizeLogData(args) } : undefined,
      category: context,
    });

    // Also capture as a warning-level message for visibility
    Sentry.captureMessage(`[${context}] ${message}`, "warning");
  },
  error: (context: string, message: string, ...args: unknown[]) => {
    const errorMessage = `[${context}] ${message}`;

    // Create an error object for better stack traces
    const error = new Error(errorMessage);
    error.name = `${context}Error`;

    // Add breadcrumb for context
    Sentry.addBreadcrumb({
      level: "error",
      message: errorMessage,
      data: args.length > 0 ? { args: sanitizeLogData(args) } : undefined,
      category: context,
    });

    // Capture the error with additional context
    Sentry.captureException(error, {
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
    sentryAdapter.debug(context, message, ...args);
  },
  info: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.info(context, message, ...args);
    sentryAdapter.info(context, message, ...args);
  },
  warn: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.warn(context, message, ...args);
    sentryAdapter.warn(context, message, ...args);
  },
  error: (context: string, message: string, ...args: unknown[]) => {
    consoleAdapter.error(context, message, ...args);
    sentryAdapter.error(context, message, ...args);
  },
};

/**
 * Initialize Sentry integration for the logger
 * This should be called after Sentry.init() in the application bootstrap
 */
export const initializeSentryLogger = (): void => {
  // Use combined adapter for development (console + Sentry for Spotlight),
  // Sentry only for production
  logger.setAdapter(__DEV__ ? combinedAdapter : sentryAdapter);
};
