import { renderHook } from "@testing-library/react-hooks";
import { AUTH_ERROR_TOAST_ID } from "hooks/useAuthErrorToast";
import { useSetupFailedToast } from "hooks/useSetupFailedToast";

const mockClearError = jest.fn();
const mockShowToast = jest.fn();

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ clearError: mockClearError }),
}));

jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

describe("useSetupFailedToast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears the store error and shows the setup-failed toast", () => {
    const { result } = renderHook(() => useSetupFailedToast());

    result.current();

    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        toastId: AUTH_ERROR_TOAST_ID,
        variant: "error",
        title: "authStore.error.setupFailedTitle",
        message: "authStore.error.setupFailedMessage",
      }),
    );
  });
});
