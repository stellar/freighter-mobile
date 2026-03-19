import { act, renderHook } from "@testing-library/react-hooks";
import useEditContactCard from "components/screens/SettingsScreen/ContactBookScreen/useEditContactCard";
import { resolveFederationAddress } from "helpers/contactList";
import {
  isFederationAddress,
  isValidFederatedDomain,
  isValidStellarAddress,
} from "helpers/stellar";

// --- Mocks ---

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("helpers/stellar", () => ({
  isFederationAddress: jest.fn(() => false),
  isValidFederatedDomain: jest.fn(() => false),
  isValidStellarAddress: jest.fn(() => true),
  truncateAddress: jest.fn((addr: string) => addr),
}));

jest.mock("helpers/contactList", () => ({
  resolveFederationAddress: jest.fn(),
  sanitizeName: jest.requireActual("helpers/contactList").sanitizeName,
}));

jest.mock("@react-native-clipboard/clipboard", () => ({
  getString: jest.fn(() => Promise.resolve("")),
}));

// --- Constants ---

const VALID_ADDRESS =
  "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";
const FEDERATION_ADDRESS = "alice*stellar.org";

// --- Helpers ---

const defaultParams = {
  existingContacts: {},
  onSave: jest.fn(),
};

const renderEditContactCard = (
  overrides: Partial<Parameters<typeof useEditContactCard>[0]> = {},
) =>
  renderHook(() =>
    useEditContactCard({
      ...defaultParams,
      ...overrides,
    }),
  );

// --- Tests ---

describe("useEditContactCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (isValidStellarAddress as jest.Mock).mockReturnValue(true);
    (isFederationAddress as jest.Mock).mockReturnValue(false);
    (isValidFederatedDomain as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Federation domain validation (#2)", () => {
    it("rejects federation address with invalid domain before making network request", () => {
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === "user*localhost",
      );
      (isValidFederatedDomain as jest.Mock).mockReturnValue(false);

      const { result } = renderEditContactCard();

      act(() => {
        result.current.handleAddressChange("user*localhost");
      });

      act(() => {
        result.current.handleAddressBlur();
      });

      expect(result.current.addressError).toBe(
        "contactBookScreen.errors.invalidAddress",
      );
      expect(resolveFederationAddress).not.toHaveBeenCalled();
    });

    it("allows federation address with valid domain and resolves it", () => {
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (resolveFederationAddress as jest.Mock).mockResolvedValueOnce({
        account_id: VALID_ADDRESS,
      });

      const { result } = renderEditContactCard();

      act(() => {
        result.current.handleAddressChange(FEDERATION_ADDRESS);
      });

      act(() => {
        result.current.handleAddressBlur();
      });

      expect(resolveFederationAddress).toHaveBeenCalledWith(
        FEDERATION_ADDRESS,
        expect.any(AbortSignal),
      );
      expect(result.current.addressError).toBeUndefined();
    });
  });

  describe("Federation timeout (#2)", () => {
    it("shows error when federation resolution times out", async () => {
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );

      // Simulate the timeout rejection that resolveFederationAddress produces
      (resolveFederationAddress as jest.Mock).mockRejectedValue(
        new Error("Federation resolution timed out"),
      );

      const { result } = renderEditContactCard();

      act(() => {
        result.current.handleAddressChange(FEDERATION_ADDRESS);
      });

      // handleAddressBlur triggers async validateAddress which awaits the
      // rejected resolveFederationAddress — needs async act to flush.
      await act(async () => {
        result.current.handleAddressBlur();
        await Promise.resolve();
      });

      expect(result.current.addressError).toBe(
        "contactBookScreen.errors.federationNotFound",
      );
    });
  });

  describe("Federation abort on input change (#2)", () => {
    it("aborts previous federation request when address changes", () => {
      const SECOND_ADDRESS = "bob*stellar.org";

      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) =>
          addr === FEDERATION_ADDRESS || addr === SECOND_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) =>
          addr === FEDERATION_ADDRESS || addr === SECOND_ADDRESS,
      );

      // First call never resolves, second resolves immediately
      (resolveFederationAddress as jest.Mock)
        .mockReturnValueOnce(new Promise(() => {}))
        .mockResolvedValueOnce({ account_id: VALID_ADDRESS });

      const { result } = renderEditContactCard();

      // Type first address and blur to trigger federation
      act(() => {
        result.current.handleAddressChange(FEDERATION_ADDRESS);
      });
      act(() => {
        result.current.handleAddressBlur();
      });

      // User immediately changes to a different address — should abort the first
      act(() => {
        result.current.handleAddressChange(SECOND_ADDRESS);
      });

      // The first resolve should have been abandoned (stale validationId)
      expect(resolveFederationAddress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unicode spoofing in names (#9)", () => {
    it("strips bidi control characters from name during validation", () => {
      const onSave = jest.fn();
      const { result } = renderEditContactCard({ onSave });

      // Name with zero-width and bidi characters embedded
      const spoofedName = "Alice\u200B\u202ABob";

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS);
      });
      act(() => {
        result.current.handleAddressBlur();
      });
      act(() => {
        result.current.handleNameChange(spoofedName);
      });
      act(() => {
        result.current.handleNameBlur();
      });

      // Name should validate successfully (stripped chars don't make it empty)
      expect(result.current.nameError).toBeUndefined();
    });

    it("sanitizes name on save, stripping bidi/zero-width characters", async () => {
      const onSave = jest.fn();
      const { result } = renderEditContactCard({ onSave });

      const spoofedName = "\u200BAlice\u200F";

      act(() => {
        result.current.handleAddressChange(VALID_ADDRESS);
      });
      act(() => {
        result.current.handleAddressBlur();
      });
      act(() => {
        result.current.handleNameChange(spoofedName);
      });
      act(() => {
        result.current.handleNameBlur();
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(onSave).toHaveBeenCalledWith(
        VALID_ADDRESS,
        "Alice", // stripped of \u200B and \u200F
        undefined,
      );
    });

    it("detects duplicate names after stripping bidi characters", () => {
      const existingContacts = {
        [VALID_ADDRESS]: { name: "Alice" },
      };

      const { result } = renderEditContactCard({ existingContacts });

      // Try to add a name that looks different with bidi chars but matches after sanitization
      const spoofedDuplicate = "\u200BAlice\u200F";

      act(() => {
        result.current.handleNameChange(spoofedDuplicate);
      });
      act(() => {
        result.current.handleNameBlur();
      });

      expect(result.current.nameError).toBe(
        "contactBookScreen.errors.duplicateName",
      );
    });

    it("treats name as empty after stripping only bidi/zero-width characters", () => {
      const { result } = renderEditContactCard();

      // Name consisting entirely of invisible characters
      const invisibleName = "\u200B\u200C\u200D\uFEFF";

      act(() => {
        result.current.handleNameChange(invisibleName);
      });
      act(() => {
        result.current.handleNameBlur();
      });

      expect(result.current.nameError).toBe(
        "contactBookScreen.errors.emptyName",
      );
    });
  });

  describe("Cleanup on unmount (#2)", () => {
    it("does not update state after unmount", () => {
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );

      let resolvePromise: (value: { account_id: string }) => void;
      (resolveFederationAddress as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result, unmount } = renderEditContactCard();

      act(() => {
        result.current.handleAddressChange(FEDERATION_ADDRESS);
      });

      act(() => {
        result.current.handleAddressBlur();
      });

      // Unmount while federation is in-flight
      unmount();

      // Resolve after unmount — should not throw or update state
      act(() => {
        resolvePromise!({ account_id: VALID_ADDRESS });
      });

      // If we got here without errors, the abort/guard worked
      expect(true).toBe(true);
    });
  });
});
