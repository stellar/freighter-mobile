/* eslint-disable no-console */
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
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Default console adapter implementation
 */
const consoleAdapter: LoggerAdapter = {
  debug: (message: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
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
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: unknown[]): void {
    this.adapter.debug(message, ...args);
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: unknown[]): void {
    this.adapter.info(message, ...args);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: unknown[]): void {
    this.adapter.warn(message, ...args);
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: unknown[]): void {
    this.adapter.error(message, ...args);
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();

/**
 * Example Sentry adapter implementation
 *
 * @example
 * ```typescript
 * import * as Sentry from "@sentry/react-native";
 *
 * const sentryAdapter: LoggerAdapter = {
 *   debug: (message, ...args) => Sentry.addBreadcrumb({ level: "debug", message, data: args }),
 *   info: (message, ...args) => Sentry.addBreadcrumb({ level: "info", message, data: args }),
 *   warn: (message, ...args) => Sentry.addBreadcrumb({ level: "warning", message, data: args }),
 *   error: (message, ...args) => Sentry.captureException(new Error(message), { extra: args }),
 * };
 *
 * logger.setAdapter(sentryAdapter);
 * ```
 */
