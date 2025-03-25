/* eslint-disable no-console */
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
