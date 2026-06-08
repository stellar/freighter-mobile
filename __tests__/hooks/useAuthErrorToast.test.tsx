import { renderHook } from "@testing-library/react-hooks";
import {
  AUTH_ERROR_TOAST_ID,
  useAuthErrorToast,
} from "hooks/useAuthErrorToast";

const mockClearError = jest.fn();
const mockClearAccountError = jest.fn();
const mockShowToast = jest.fn();

let mockStoreState: Record<string, unknown>;

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => mockStoreState,
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

const baseState = () => ({
  error: null,
  accountError: null,
  authStatus: "AUTHENTICATED",
  clearError: mockClearError,
  clearAccountError: mockClearAccountError,
});

describe("useAuthErrorToast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = baseState();
  });

  it("does not toast or clear an inline-handled error (invalidPassword)", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.invalidPassword",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockClearError).not.toHaveBeenCalled();
  });

  it("silently clears failedToGetAllAccounts without toasting", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.failedToGetAllAccounts",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("toasts failedToLogout with its specific title and message", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.failedToLogout",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        toastId: AUTH_ERROR_TOAST_ID,
        title: "authStore.error.logoutFailedTitle",
        message: "authStore.error.logoutFailedMessage",
      }),
    );
    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("toasts failedToSignIn with its specific title and message", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.failedToSignIn",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        toastId: AUTH_ERROR_TOAST_ID,
        title: "authStore.error.signInFailedTitle",
        message: "authStore.error.signInFailedMessage",
      }),
    );
    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("toasts an unknown error with the generic title, then clears it", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.unknownError",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        toastId: AUTH_ERROR_TOAST_ID,
        title: "authStore.error.notificationTitle",
        message: "authStore.error.unknownError",
      }),
    );
    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it("uses the lock-screen copy for failedToLoadAccount", () => {
    mockStoreState = {
      ...baseState(),
      error: "authStore.error.failedToLoadAccount",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "lockScreen.failedToLoadAccountTitle",
        message: "lockScreen.failedToLoadAccountMessage",
      }),
    );
  });

  it("suppresses accountError during onboarding (NOT_AUTHENTICATED) but clears it", () => {
    mockStoreState = {
      ...baseState(),
      accountError: "authStore.error.failedToLoadAccount",
      authStatus: "NOT_AUTHENTICATED",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockClearAccountError).toHaveBeenCalledTimes(1);
  });

  it("toasts accountError with the load-account copy when authenticated", () => {
    mockStoreState = {
      ...baseState(),
      accountError: "authStore.error.failedToLoadAccount",
      authStatus: "AUTHENTICATED",
    };
    renderHook(() => useAuthErrorToast());

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "lockScreen.failedToLoadAccountTitle",
        message: "lockScreen.failedToLoadAccountMessage",
      }),
    );
    expect(mockClearAccountError).toHaveBeenCalledTimes(1);
  });
});
