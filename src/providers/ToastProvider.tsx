import { Toast, ToastProps, ToastVariant } from "components/sds/Toast";
import { px } from "helpers/dimensions";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
} from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastContainer = styled(View)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  align-items: center;
  pointer-events: none;
`;

const ToastWrapper = styled(View)`
  width: 100%;
  padding-top: ${px(16)};
  pointer-events: auto;
`;

interface ToastPropsWithId extends ToastProps {
  id: string;
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

  const showToast = useCallback((options: ToastOptions) => {
    const newToast: ToastPropsWithId = {
      ...options,
      id: Date.now().toString(),
      onDismiss: () => {
        setToasts((currentToasts) =>
          currentToasts.filter((toast) => toast.id !== newToast.id),
        );
      },
    };

    setToasts((currentToasts) => [...currentToasts, newToast]);
  }, []);

  const handleDismiss = useCallback((toast: ToastPropsWithId) => {
    setToasts((currentToasts) =>
      currentToasts.filter((t) => t.id !== toast.id),
    );
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer>
        <SafeAreaView edges={["top"]} style={{ width: "100%" }}>
          <ToastWrapper>
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                {...toast}
                onDismiss={() => handleDismiss(toast)}
              />
            ))}
          </ToastWrapper>
        </SafeAreaView>
      </ToastContainer>
    </ToastContext.Provider>
  );
};
