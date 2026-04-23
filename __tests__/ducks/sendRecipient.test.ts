import { Federation, StrKey } from "@stellar/stellar-sdk";
import { act } from "@testing-library/react-hooks";
import { STORAGE_KEYS } from "config/constants";
import { getActiveAccountPublicKey } from "ducks/auth";
import { useSendRecipientStore } from "ducks/sendRecipient";
import * as stellarHelpers from "helpers/stellar";
import { getAccount } from "services/stellar";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("i18next", () => ({
  t: jest.fn((key) => key),
}));

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock("services/stellar", () => ({
  getAccount: jest.fn(),
}));

jest.mock("ducks/auth", () => ({
  getActiveAccountPublicKey: jest.fn(),
  useAuthenticationStore: {
    getState: () => ({
      network: "TESTNET",
    }),
  },
}));

jest.mock("helpers/stellar", () => ({
  isFederationAddress: jest.fn(),
  isSameAccount: jest.fn(),
  isValidStellarAddress: jest.fn(),
}));

jest.mock("@stellar/stellar-sdk", () => ({
  Federation: {
    Server: {
      resolve: jest.fn(),
    },
  },
  StrKey: {
    isValidEd25519PublicKey: jest.fn(),
  },
  Networks: jest.requireActual("@stellar/stellar-sdk").Networks,
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("config/constants", () => {
  const originalModule = jest.requireActual("config/constants");
  return {
    ...originalModule,
    Networks: originalModule.Networks,
    STORAGE_KEYS: {
      RECENT_ADDRESSES: "RECENT_ADDRESSES",
      ...(originalModule.STORAGE_KEYS || {}),
    },
  };
});

const store = useSendRecipientStore;

describe("sendRecipient Duck", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockFederationAddress = "user*example.com";
  const mockRecentAddresses = ["address1", "address2"];

  beforeEach(() => {
    jest.clearAllMocks();

    act(() => {
      store.setState({
        recentAddresses: [],
        searchResults: [],
        destinationAddress: "",
        federationAddress: "",
        federationMemo: "",
        federationMemoType: "",
        isSearching: false,
        searchError: null,
        isValidDestination: false,
        isDestinationFunded: null,
      });
    });

    (dataStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(mockRecentAddresses),
    );
    (stellarHelpers.isValidStellarAddress as jest.Mock).mockReturnValue(true);
    (stellarHelpers.isSameAccount as jest.Mock).mockReturnValue(false);
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(false);
    (getAccount as jest.Mock).mockResolvedValue({ id: mockPublicKey });
    (getActiveAccountPublicKey as jest.Mock).mockResolvedValue("DIFFERENT_KEY");
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
  });

  it("should have correct initial state", () => {
    const state = store.getState();
    expect(state.recentAddresses).toEqual([]);
    expect(state.searchResults).toEqual([]);
    expect(state.destinationAddress).toBe("");
    expect(state.federationAddress).toBe("");
    expect(state.isSearching).toBe(false);
    expect(state.searchError).toBeNull();
    expect(state.isValidDestination).toBe(false);
    expect(state.isDestinationFunded).toBeNull();
  });

  it("should load recent addresses from storage", async () => {
    await store.getState().loadRecentAddresses();

    expect(dataStorage.getItem).toHaveBeenCalledWith(
      STORAGE_KEYS.RECENT_ADDRESSES,
    );
    expect(store.getState().recentAddresses).toHaveLength(2);
    expect(store.getState().recentAddresses[0].address).toBe("address1");
  });

  it("should handle storage errors in loadRecentAddresses", async () => {
    (dataStorage.getItem as jest.Mock).mockRejectedValue(
      new Error("Storage error"),
    );

    await store.getState().loadRecentAddresses();

    expect(store.getState().recentAddresses).toEqual([]);
  });

  it("should add a new address to recent addresses", async () => {
    const newAddress = "newaddress";

    await store.getState().addRecentAddress(newAddress);

    expect(dataStorage.setItem).toHaveBeenCalled();
  });

  it("should not write to storage when address already exists with the same name", async () => {
    act(() => {
      store.setState({
        recentAddresses: [
          { id: "recent-1", address: "existingAddress", name: "alice*fed.com" },
        ],
      });
    });

    await store.getState().addRecentAddress("existingAddress", "alice*fed.com");

    expect(dataStorage.setItem).not.toHaveBeenCalled();
  });

  it("should validate and search for a Stellar address", async () => {
    await store.getState().searchAddress(mockPublicKey);

    expect(store.getState().isValidDestination).toBe(true);
    expect(store.getState().isDestinationFunded).toBe(true);
    expect(store.getState().searchResults).toHaveLength(1);
    expect(store.getState().searchResults[0].address).toBe(mockPublicKey);
  });

  it("should handle federation addresses", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockResolvedValue({
      account_id: mockPublicKey,
    });

    await store.getState().searchAddress(mockFederationAddress);

    expect(store.getState().destinationAddress).toBe(mockPublicKey);
    expect(store.getState().federationAddress).toBe(mockFederationAddress);
    expect(store.getState().federationMemo).toBe("");
    expect(store.getState().federationMemoType).toBe("");
  });

  it("should capture federation memo and memo_type when server returns them", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockResolvedValue({
      account_id: mockPublicKey,
      memo: "12345",
      memo_type: "id",
    });

    await store.getState().searchAddress(mockFederationAddress);

    expect(store.getState().destinationAddress).toBe(mockPublicKey);
    expect(store.getState().federationMemo).toBe("12345");
    expect(store.getState().federationMemoType).toBe("id");
  });

  it("should error when federation server returns a malformed account_id", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockResolvedValue({
      account_id: "not-a-valid-key",
    });
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(false);

    await store.getState().searchAddress(mockFederationAddress);

    expect(store.getState().searchError).toBe(
      "sendRecipient.error.federationNotFound",
    );
    expect(store.getState().isValidDestination).toBe(false);
    expect(store.getState().destinationAddress).toBe("");
  });

  it("should error when Federation.Server.resolve rejects", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockRejectedValue(
      new Error("DNS failure"),
    );

    await store.getState().searchAddress(mockFederationAddress);

    expect(store.getState().searchError).toBe(
      "sendRecipient.error.federationNotFound",
    );
    expect(store.getState().isSearching).toBe(false);
    expect(store.getState().isValidDestination).toBe(false);
  });

  it("should error when resolved federation address is the user's own account", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockResolvedValue({
      account_id: mockPublicKey,
    });
    (getActiveAccountPublicKey as jest.Mock).mockResolvedValue(mockPublicKey);
    // First call: federation string vs own key → false (different format, no match)
    // Second call: resolved G... key vs own key → true (it is the same account)
    (stellarHelpers.isSameAccount as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await store.getState().searchAddress(mockFederationAddress);

    expect(store.getState().searchError).toBe(
      "sendRecipient.error.sendToSelfFederation",
    );
    expect(store.getState().isValidDestination).toBe(false);
  });

  it("should call Federation.Server.resolve with a 10 second timeout", async () => {
    (stellarHelpers.isFederationAddress as jest.Mock).mockReturnValue(true);
    (Federation.Server.resolve as jest.Mock).mockResolvedValue({
      account_id: mockPublicKey,
    });

    await store.getState().searchAddress(mockFederationAddress);

    expect(Federation.Server.resolve).toHaveBeenCalledWith(
      mockFederationAddress,
      { timeout: 10000 },
    );
  });

  it("should update federation name on existing recent address", async () => {
    act(() => {
      store.setState({
        recentAddresses: [{ id: "recent-1", address: "existingAddress" }],
      });
    });

    await store.getState().addRecentAddress("existingAddress", "alice*fed.com");

    const updated = store
      .getState()
      .recentAddresses.find((c) => c.address === "existingAddress");
    expect(updated?.name).toBe("alice*fed.com");
    expect(dataStorage.setItem).toHaveBeenCalled();
  });

  it("should handle invalid address format", async () => {
    (stellarHelpers.isValidStellarAddress as jest.Mock).mockReturnValue(false);

    await store.getState().searchAddress("invalid-address");

    expect(store.getState().searchError).toBe(
      "sendRecipient.error.invalidAddressFormat",
    );
    expect(store.getState().isValidDestination).toBe(false);
  });

  it("should handle unfunded accounts", async () => {
    (getAccount as jest.Mock).mockRejectedValue({ response: { status: 404 } });

    await store.getState().searchAddress(mockPublicKey);

    expect(store.getState().isDestinationFunded).toBe(false);
    expect(store.getState().isValidDestination).toBe(true);
  });

  it("should set destination address", () => {
    store.getState().setDestinationAddress(mockPublicKey);

    expect(store.getState().destinationAddress).toBe(mockPublicKey);
    expect(store.getState().federationAddress).toBe("");
    expect(store.getState().isValidDestination).toBe(true);
  });

  it("should set federation address when provided", () => {
    store
      .getState()
      .setDestinationAddress(mockPublicKey, mockFederationAddress);

    expect(store.getState().destinationAddress).toBe(mockPublicKey);
    expect(store.getState().federationAddress).toBe(mockFederationAddress);
  });

  it("should reset all search-related state", () => {
    act(() => {
      store.setState({
        searchResults: [{ id: "1", address: "address" }],
        destinationAddress: "address",
        federationAddress: "fed*address",
        isSearching: true,
        searchError: "error",
        isValidDestination: true,
        isDestinationFunded: true,
      });
    });

    store.getState().resetSendRecipient();

    expect(store.getState().searchResults).toEqual([]);
    expect(store.getState().destinationAddress).toBe("");
    expect(store.getState().federationAddress).toBe("");
    expect(store.getState().isSearching).toBe(false);
    expect(store.getState().searchError).toBeNull();
    expect(store.getState().isValidDestination).toBe(false);
    expect(store.getState().isDestinationFunded).toBeNull();
  });
});
