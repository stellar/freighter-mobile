import { Toast, ToastProps, ToastVariant } from "components/sds/Toast";
import { DEFAULT_PADDING, SOFT_LOCK_ALLOWED_TOAST_IDS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { px, pxValue } from "helpers/dimensions";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
} from "react";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

export interface ToastOptions {
  /** Variant of the toast */
  variant: ToastVariant;
  /** Toast title */
  title: string;
  /** Toast icon */
  icon?: React.ReactNode;
  /** Toast message */
  message?: string;
  /** Duration in milliseconds before auto-dismissing (default: 3000) */
  duration?: number;
  /** Optional ID for the toast. If a toast with the same ID already exists, it will be replaced */
  toastId?: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  dismissToast: (toastId: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastContainer = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  align-items: center;
`;

interface ToastWrapperProps {
  $insets: EdgeInsets;
}

const ToastWrapper = styled.View<ToastWrapperProps>`
  width: 100%;
  padding-top: ${({ $insets }: ToastWrapperProps) =>
    `${$insets.top + pxValue(16)}px`};
  padding-horizontal: ${pxValue(DEFAULT_PADDING)}px;
  gap: ${px(16)};
`;

interface ToastPropsWithId extends ToastProps {
  toastId: string;
}

/**
 * Hook to access the toast functionality
 *
 * @example
 * const { showToast } = useToast();
 *
 * // Show a success toast
 * showToast({
 *   variant: "success",
 *   title: "Success!",
 *   message: "Your action was completed successfully.",
 * });
 *
 * // Show a toast with a specific ID (will replace existing toast with same ID)
 * showToast({
 *   variant: "success",
 *   title: "Copied!",
 *   toastId: "copy-toast"
 * });
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for toast notifications
 *
 * @example
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastPropsWithId[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((options: ToastOptions) => {
    // While soft-locked, the navigation tree stays mounted under the lock
    // overlay and may still emit toasts (stale network errors, re-run
    // validations). Suppress everything except the lock overlay's own
    // messaging so nothing surfaces over the lock until the app is usable.
    // Read imperatively (not via a reactive selector) to avoid coupling this
    // low-level provider's render cycle to the auth store; the optional chain
    // keeps it safe under test mocks that stub the store without getState.
    const isSoftLocked =
      useAuthenticationStore.getState?.()?.isSoftLocked ?? false;
    if (
      isSoftLocked &&
      !(
        options.toastId && SOFT_LOCK_ALLOWED_TOAST_IDS.includes(options.toastId)
      )
    ) {
      return;
    }

    const newToast: ToastPropsWithId = {
      ...options,
      toastId: options.toastId ?? Date.now().toString(),
    };

    setToasts((currentToasts) => {
      // If we have a toastId, remove any existing toast with the same ID
      if (options.toastId) {
        const filteredToasts = currentToasts.filter(
          (toast) => toast.toastId !== options.toastId,
        );
        return [...filteredToasts, newToast];
      }
      return [...currentToasts, newToast];
    });
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((t) => t.toastId !== toastId),
    );
  }, []);

  const contextValue = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastContainer>
        <ToastWrapper $insets={insets}>
          {toasts.map((toast) => (
            <Toast
              key={toast.toastId}
              {...toast}
              onDismiss={() => dismissToast(toast.toastId)}
            />
          ))}
        </ToastWrapper>
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  );
};
