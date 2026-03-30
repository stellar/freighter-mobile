import { Federation } from "@stellar/stellar-sdk";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import ContactBookScreen from "components/screens/SettingsScreen/ContactBookScreen";
import {
  isValidStellarAddress,
  isFederationAddress,
  isValidFederatedDomain,
} from "helpers/stellar";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// --- Mocks ---

jest.mock("components/primitives/Menu", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const RN = require("react-native");

  const MenuRoot = ({ children }: { children: React.ReactNode }) => (
    <RN.View>{children}</RN.View>
  );
  const MenuTrigger = ({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) => <RN.Pressable testID={testID}>{children}</RN.Pressable>;
  const MenuContent = ({ children }: { children: React.ReactNode }) => (
    <RN.View>{children}</RN.View>
  );
  const MenuItemComponent = ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect: () => void;
  }) => <RN.Pressable onPress={onSelect}>{children}</RN.Pressable>;
  const MenuItemTitle = ({ children }: { children: React.ReactNode }) => (
    <RN.Text>{children}</RN.Text>
  );
  const MenuItemIcon = () => <RN.View />;
  const MenuGroup = ({ children }: { children: React.ReactNode }) => (
    <RN.View>{children}</RN.View>
  );

  return {
    MenuRoot,
    MenuTrigger,
    MenuContent,
    MenuItem: MenuItemComponent,
    MenuItemTitle,
    MenuItemIcon,
    MenuGroup,
  };
});

jest.mock("services/analytics", () => ({
  analytics: {
    trackContactBookAdd: jest.fn(),
    trackContactBookEdit: jest.fn(),
    trackContactBookDelete: jest.fn(),
  },
}));

const mockAnalytics =
  jest.requireMock<typeof import("services/analytics")>(
    "services/analytics",
  ).analytics;

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      primary: "#000",
      foreground: { primary: "#000", secondary: "#999" },
      text: { primary: "#000", secondary: "#999" },
      background: { tertiary: "#f3f3f3" },
      status: { success: "#0f0" },
      gray: { 9: "#999" },
      lilac: { 9: "#8b5cf6" },
    },
  }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}));

const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("helpers/stellar", () => ({
  isValidStellarAddress: jest.fn(),
  isFederationAddress: jest.fn(() => false),
  isValidFederatedDomain: jest.fn(() => false),
  isMuxedAccount: jest.fn(() => false),
  getBaseAccount: jest.fn((addr: string) => addr),
  truncateAddress: jest.fn(
    (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`,
  ),
}));

jest.mock("@stellar/stellar-sdk", () => ({
  Federation: { Server: { resolve: jest.fn() } },
  Networks: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
    FUTURENET: "Test SDF Future Network ; October 2022",
  },
}));

jest.mock("@react-native-clipboard/clipboard", () => ({
  getString: jest.fn(() => Promise.resolve("")),
}));

const mockClipboard = jest.requireMock<{ getString: jest.Mock }>(
  "@react-native-clipboard/clipboard",
);
jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 44,
}));

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: "View",
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetView: "View",
  BottomSheetScrollView: "ScrollView",
  BottomSheetBackdrop: "View",
  BottomSheetFooter: "View",
}));

jest.mock("components/BottomSheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const RN = require("react-native");

  return {
    __esModule: true,
    default: ({
      customContent,
      modalRef,
      bottomSheetModalProps,
    }: {
      customContent: React.ReactNode;
      modalRef: React.RefObject<{ present: () => void; dismiss: () => void }>;
      bottomSheetModalProps?: { onDismiss?: () => void };
    }) => {
      // Attach mock methods to the ref so the component can call present/dismiss
      if (modalRef && typeof modalRef === "object") {
        // eslint-disable-next-line no-param-reassign
        (modalRef as { current: unknown }).current = {
          present: mockPresent,
          dismiss: () => {
            mockDismiss();
            bottomSheetModalProps?.onDismiss?.();
          },
        };
      }
      return <RN.View testID="bottom-sheet-mock">{customContent}</RN.View>;
    },
  };
});

const mockUseRightHeaderButton = jest.fn();
jest.mock("hooks/useRightHeader", () => ({
  useRightHeaderButton: (params: { onPress: () => void }) =>
    mockUseRightHeaderButton(params),
  useRightHeaderMenu: jest.fn(),
}));

// --- Constants ---

const VALID_ADDRESS_1 =
  "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";
const VALID_ADDRESS_2 =
  "GBKWMR7TJ7BBICOOXRY2SWXKCWPTOHZPI6MP4LNNE5A73VP3WADGG3CH";

// --- Helpers ---

const pressHeaderAddButton = () => {
  const lastCall = mockUseRightHeaderButton.mock.calls.at(-1);
  lastCall[0].onPress();
};

const renderScreen = () => renderWithProviders(<ContactBookScreen />);

const addContact = async (
  getByText: ReturnType<typeof renderScreen>["getByText"],
  getByPlaceholderText: ReturnType<typeof renderScreen>["getByPlaceholderText"],
  address: string,
  name: string,
  useHeaderButton = false,
) => {
  if (useHeaderButton) {
    act(() => {
      pressHeaderAddButton();
    });
  } else {
    fireEvent.press(getByText("contactBookScreen.addContact"));
  }

  const addressInput = getByPlaceholderText(
    "contactBookScreen.addressPlaceholder",
  );
  const nameInput = getByPlaceholderText("contactBookScreen.namePlaceholder");

  fireEvent.changeText(addressInput, address);
  fireEvent(addressInput, "blur");
  fireEvent.changeText(nameInput, name);
  fireEvent(nameInput, "blur");

  await waitFor(() => {
    fireEvent.press(getByText("contactBookScreen.save"));
  });

  await waitFor(() => {
    expect(getByText(name)).toBeTruthy();
  });
};

describe("ContactBookScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isValidStellarAddress as jest.Mock).mockReturnValue(true);
    (isFederationAddress as jest.Mock).mockReturnValue(false);
  });

  describe("Empty State", () => {
    it("renders empty state with message and add button", () => {
      const { getByText } = renderScreen();

      expect(getByText("contactBookScreen.empty")).toBeTruthy();
      expect(getByText("contactBookScreen.addContact")).toBeTruthy();
    });

    it("opens add modal when empty state add button is pressed", () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      expect(mockPresent).toHaveBeenCalled();
      expect(getByText("contactBookScreen.addTitle")).toBeTruthy();
    });
  });

  describe("Add Contact Flow", () => {
    it("shows EditContactCard with add title when opening modal", () => {
      const { getByText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      expect(getByText("contactBookScreen.addTitle")).toBeTruthy();
      expect(getByText("contactBookScreen.save")).toBeTruthy();
      expect(getByText("contactBookScreen.paste")).toBeTruthy();
    });

    it("adds a contact and shows it in the list", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      // Open add modal
      fireEvent.press(getByText("contactBookScreen.addContact"));

      // Fill in fields
      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );
      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );

      fireEvent.changeText(addressInput, VALID_ADDRESS_1);
      fireEvent(addressInput, "blur");
      fireEvent.changeText(nameInput, "Alice");
      fireEvent(nameInput, "blur");

      // Save
      await waitFor(() => {
        const saveButton = getByText("contactBookScreen.save");
        fireEvent.press(saveButton);
      });

      // Contact should appear in the list
      await waitFor(() => {
        expect(getByText("Alice")).toBeTruthy();
      });
    });

    it("shows toast when contact is added", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );
      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );

      fireEvent.changeText(addressInput, VALID_ADDRESS_1);
      fireEvent(addressInput, "blur");
      fireEvent.changeText(nameInput, "Alice");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        fireEvent.press(getByText("contactBookScreen.save"));
      });

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "success",
            title: "contactBookScreen.contactAdded",
          }),
        );
      });
    });
  });

  describe("EditContactCard Validation", () => {
    it("Save button is disabled when fields are empty", () => {
      const { getByText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const saveButton = getByTestId("save-button");
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });

    it("Save button is disabled when only address is filled", () => {
      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );
      fireEvent.changeText(addressInput, VALID_ADDRESS_1);
      fireEvent(addressInput, "blur");

      // Name is still empty, so save should still be disabled
      const saveButton = getByTestId("save-button");
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });

    it("Save button is disabled when only name is filled", () => {
      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );
      fireEvent.changeText(nameInput, "Alice");
      fireEvent(nameInput, "blur");

      const saveButton = getByTestId("save-button");
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });

    it("shows error for invalid Stellar address on blur", () => {
      (isValidStellarAddress as jest.Mock).mockReturnValue(false);

      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );
      fireEvent.changeText(addressInput, "INVALIDADDRESS");
      fireEvent(addressInput, "blur");

      expect(getByText("contactBookScreen.errors.invalidAddress")).toBeTruthy();
    });

    it("shows error for empty name on blur", () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );
      // Type something then clear it to trigger empty validation on blur
      fireEvent.changeText(nameInput, "A");
      fireEvent.changeText(nameInput, "");
      fireEvent(nameInput, "blur");

      // Empty name now shows an error message
      expect(getByText("contactBookScreen.errors.emptyName")).toBeTruthy();
    });

    it("shows duplicate address error", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      // First, add a contact
      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      // Now try to add a contact with the same address
      act(() => {
        pressHeaderAddButton();
      });

      const addressInput2 = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );

      fireEvent.changeText(addressInput2, VALID_ADDRESS_1);
      fireEvent(addressInput2, "blur");

      await waitFor(() => {
        expect(
          getByText("contactBookScreen.errors.duplicateAddress"),
        ).toBeTruthy();
      });
    });

    it("enables Save button when federation address resolves successfully", async () => {
      const FEDERATION_ADDRESS = "alice*stellar.org";
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (Federation.Server.resolve as jest.Mock).mockResolvedValueOnce({
        account_id: VALID_ADDRESS_1,
      });

      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );
      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );

      fireEvent.changeText(addressInput, FEDERATION_ADDRESS);
      fireEvent(addressInput, "blur");
      fireEvent.changeText(nameInput, "Alice");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        const saveButton = getByTestId("save-button");
        expect(saveButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it("shows federation error and keeps Save disabled when address resolution fails", async () => {
      const FEDERATION_ADDRESS = "alice*stellar.org";
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (Federation.Server.resolve as jest.Mock).mockRejectedValueOnce(
        new Error("Not found"),
      );

      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));

      const addressInput = getByPlaceholderText(
        "contactBookScreen.addressPlaceholder",
      );

      fireEvent.changeText(addressInput, FEDERATION_ADDRESS);
      fireEvent(addressInput, "blur");

      await waitFor(() => {
        expect(
          getByText("contactBookScreen.errors.federationNotFound"),
        ).toBeTruthy();
      });

      const saveButton = getByTestId("save-button");
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });

    it("shows duplicate name error", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      // First, add a contact
      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      // Now try to add a contact with the same name
      act(() => {
        pressHeaderAddButton();
      });

      const nameInput2 = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );

      fireEvent.changeText(nameInput2, "Alice");
      fireEvent(nameInput2, "blur");

      await waitFor(() => {
        expect(
          getByText("contactBookScreen.errors.duplicateName"),
        ).toBeTruthy();
      });
    });
  });

  describe("Contact List", () => {
    it("displays contact name and truncated address", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      expect(getByText("Alice")).toBeTruthy();
      // truncateAddress mock returns first 4 + "..." + last 4
      expect(
        getByText(
          `${VALID_ADDRESS_1.slice(0, 4)}...${VALID_ADDRESS_1.slice(-4)}`,
        ),
      ).toBeTruthy();
    });

    it("can add multiple contacts", async () => {
      const { getByText, getByPlaceholderText } = renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );
      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_2,
        "Bob",
        true,
      );

      expect(getByText("Alice")).toBeTruthy();
      expect(getByText("Bob")).toBeTruthy();
    });
  });

  describe("Edit Contact Flow", () => {
    it("opens edit card with pre-populated fields via context menu", async () => {
      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      // Press context menu trigger
      fireEvent.press(getByTestId(`contact-menu-${VALID_ADDRESS_1}`));

      // Press edit action - context menu actions are called via onPress
      // Since we're using a mock ContextMenuButton, we need to trigger the action
      // The context menu renders MenuItems; simulate the edit action
      fireEvent.press(getByText("contactBookScreen.editContact"));

      // The edit card should show with pre-populated data
      await waitFor(() => {
        expect(getByText("contactBookScreen.editTitle")).toBeTruthy();
        const addressInput = getByPlaceholderText(
          "contactBookScreen.addressPlaceholder",
        );
        expect(addressInput.props.value).toBe(VALID_ADDRESS_1);
        const nameInput = getByPlaceholderText(
          "contactBookScreen.namePlaceholder",
        );
        expect(nameInput.props.value).toBe("Alice");
      });
    });

    it("saves edited contact with updated name", async () => {
      const { getByText, getByPlaceholderText, getByTestId, queryByText } =
        renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      fireEvent.press(getByTestId(`contact-menu-${VALID_ADDRESS_1}`));
      fireEvent.press(getByText("contactBookScreen.editContact"));

      await waitFor(() => {
        expect(getByText("contactBookScreen.editTitle")).toBeTruthy();
      });

      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );
      fireEvent.changeText(nameInput, "Alice Updated");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        fireEvent.press(getByText("contactBookScreen.save"));
      });

      await waitFor(() => {
        expect(getByText("Alice Updated")).toBeTruthy();
      });
      expect(queryByText("Alice")).toBeNull();
      expect(mockAnalytics.trackContactBookEdit).toHaveBeenCalled();
    });
  });

  describe("Delete Contact", () => {
    it("deletes a contact via context menu and shows toast", async () => {
      const { getByText, getByPlaceholderText, getByTestId, queryByText } =
        renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      expect(getByText("Alice")).toBeTruthy();

      fireEvent.press(getByTestId(`contact-menu-${VALID_ADDRESS_1}`));
      fireEvent.press(getByText("contactBookScreen.deleteContact"));

      await waitFor(() => {
        expect(queryByText("Alice")).toBeNull();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "success",
          title: "contactBookScreen.contactDeleted",
        }),
      );
      expect(mockAnalytics.trackContactBookDelete).toHaveBeenCalled();
    });
  });

  describe("Copy Address", () => {
    it("copies contact address via context menu", async () => {
      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      await addContact(
        getByText,
        getByPlaceholderText,
        VALID_ADDRESS_1,
        "Alice",
      );

      fireEvent.press(getByTestId(`contact-menu-${VALID_ADDRESS_1}`));
      fireEvent.press(getByText("contactBookScreen.copyAddress"));

      expect(mockCopyToClipboard).toHaveBeenCalledWith(VALID_ADDRESS_1);
    });
  });

  describe("Dismiss Card", () => {
    it("dismisses the card when pressing the cancel button", () => {
      const { getByText, queryByText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      expect(getByText("contactBookScreen.addTitle")).toBeTruthy();

      fireEvent.press(getByText("contactBookScreen.cancel"));

      expect(mockDismiss).toHaveBeenCalled();
      expect(queryByText("contactBookScreen.addTitle")).toBeNull();
    });

    it("dismisses the card when pressing the close (X) button", () => {
      const { getByText, getByTestId, queryByText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      expect(getByText("contactBookScreen.addTitle")).toBeTruthy();

      fireEvent.press(getByTestId("close-button"));

      expect(queryByText("contactBookScreen.addTitle")).toBeNull();
    });
  });

  describe("Paste Flow", () => {
    it("populates the address field with clipboard content and validates it", async () => {
      mockClipboard.getString.mockResolvedValueOnce(VALID_ADDRESS_1);

      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      fireEvent.press(getByText("contactBookScreen.paste"));

      await waitFor(() => {
        const addressInput = getByPlaceholderText(
          "contactBookScreen.addressPlaceholder",
        );
        expect(addressInput.props.value).toBe(VALID_ADDRESS_1);
      });
    });

    it("does nothing when clipboard is empty", async () => {
      mockClipboard.getString.mockResolvedValueOnce("");

      const { getByText, getByPlaceholderText } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      fireEvent.press(getByText("contactBookScreen.paste"));

      await waitFor(() => {
        const addressInput = getByPlaceholderText(
          "contactBookScreen.addressPlaceholder",
        );
        expect(addressInput.props.value).toBe("");
      });
    });

    it("enables Save button after pasting a valid Stellar address and filling name", async () => {
      mockClipboard.getString.mockResolvedValueOnce(VALID_ADDRESS_1);

      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      fireEvent.press(getByText("contactBookScreen.paste"));

      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );

      await waitFor(() => {
        fireEvent.changeText(nameInput, "Alice");
        fireEvent(nameInput, "blur");
        const saveButton = getByTestId("save-button");
        expect(saveButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it("enables Save button after pasting a federation address that resolves successfully", async () => {
      const FEDERATION_ADDRESS = "alice*stellar.org";
      mockClipboard.getString.mockResolvedValueOnce(FEDERATION_ADDRESS);
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (Federation.Server.resolve as jest.Mock).mockResolvedValueOnce({
        account_id: VALID_ADDRESS_1,
      });

      const { getByText, getByPlaceholderText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      fireEvent.press(getByText("contactBookScreen.paste"));

      const nameInput = getByPlaceholderText(
        "contactBookScreen.namePlaceholder",
      );
      fireEvent.changeText(nameInput, "Alice");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        const saveButton = getByTestId("save-button");
        expect(saveButton.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it("shows federation error and keeps Save disabled when pasted federation address fails to resolve", async () => {
      const FEDERATION_ADDRESS = "alice*stellar.org";
      mockClipboard.getString.mockResolvedValueOnce(FEDERATION_ADDRESS);
      (isFederationAddress as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (isValidFederatedDomain as jest.Mock).mockImplementation(
        (addr: string) => addr === FEDERATION_ADDRESS,
      );
      (Federation.Server.resolve as jest.Mock).mockRejectedValueOnce(
        new Error("Not found"),
      );

      const { getByText, getByTestId } = renderScreen();

      fireEvent.press(getByText("contactBookScreen.addContact"));
      fireEvent.press(getByText("contactBookScreen.paste"));

      await waitFor(() => {
        expect(
          getByText("contactBookScreen.errors.federationNotFound"),
        ).toBeTruthy();
      });

      const saveButton = getByTestId("save-button");
      expect(saveButton.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
