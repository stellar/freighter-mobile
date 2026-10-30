import { logger } from "config/logger";
import React from "react";

export interface ErrorBoundaryProps {
  /** Logger context; it becomes the Sentry `context` tag. */
  name: string;
  /** What to render in place of the children once one of them has thrown. */
  fallback: React.ReactNode;
  /** Called once per caught error, after it is reported. */
  onError?: (error: Error) => void;
  /**
   * Changing it clears a caught error, so the children render again. It is
   * compared with `Object.is`: pass a primitive or a stable reference, not a
   * value rebuilt on every render.
   */
  resetKey?: unknown;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  /** Whether a child has thrown, so the fallback shows in its place. */
  hasError: boolean;
  /** The `resetKey` last rendered with, to tell when it has changed. */
  prevResetKey: unknown;
}

/**
 * Catches an error thrown while rendering any of its children, reports it,
 * and shows `fallback` in their place, so one broken subtree does not take the
 * whole screen down. The fallback stays until `resetKey` changes.
 *
 * It is a class because React offers error boundaries only as class
 * components. They do not catch errors thrown in event handlers or async code,
 * or in the boundary itself.
 *
 * @example
 * <ErrorBoundary
 *   name="SignTransactionDetails"
 *   fallback={<UnreadableTransactionNotice />}
 *   resetKey={xdr}
 * >
 *   <TransactionDetails xdr={xdr} />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  /**
   * React calls this when a descendant throws while rendering. It switches the
   * boundary to its fallback. Reporting the error is left to
   * `componentDidCatch`: this runs during render, which must stay free of side
   * effects.
   */
  static getDerivedStateFromError(): Pick<ErrorBoundaryState, "hasError"> {
    return { hasError: true };
  }

  /**
   * Clears a caught error when `resetKey` has changed since the last render.
   *
   * It is derived while rendering, not set from `componentDidUpdate`, so the
   * children render in the same pass as the new key: the old fallback is never
   * committed alongside it, and no second render is needed.
   */
  static getDerivedStateFromProps(
    { resetKey }: ErrorBoundaryProps,
    { prevResetKey }: ErrorBoundaryState,
  ): ErrorBoundaryState | null {
    if (Object.is(resetKey, prevResetKey)) {
      return null;
    }

    return { hasError: false, prevResetKey: resetKey };
  }

  /**
   * Starts with no error. The first `resetKey` is stored as the one already
   * seen, so that only a later change counts as a reset.
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, prevResetKey: props.resetKey };
  }

  /**
   * Reports the caught error, then lets the owner react to it. React calls this
   * once per caught error, in the commit phase, so a rerender that leaves the
   * fallback in place does not report again.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const { name, onError } = this.props;

    logger.error(name, "Render error caught by error boundary", error, {
      componentStack: info.componentStack,
    });
    onError?.(error);
  }

  /** Renders the fallback once a child has thrown, the children otherwise. */
  render() {
    const { children, fallback } = this.props;
    const { hasError } = this.state;

    return hasError ? fallback : children;
  }
}
