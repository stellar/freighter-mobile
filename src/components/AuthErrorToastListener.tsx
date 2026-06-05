import { useAuthErrorToast } from "hooks/useAuthErrorToast";

/**
 * Mounts the app-wide auth-error toast listener. Renders nothing; must live
 * under both `ToastProvider` and `I18nextProvider`.
 */
export const AuthErrorToastListener = (): null => {
  useAuthErrorToast();
  return null;
};
