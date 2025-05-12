/* eslint-disable @typescript-eslint/unbound-method */
import { Federation } from "@stellar/stellar-sdk";
import { act } from "@testing-library/react-hooks";
import { STORAGE_KEYS } from "config/constants";
import { getActiveAccountPublicKey } from "ducks/auth";
import { useSendRecipientStore } from "ducks/sendRecipient";
import * as stellarHelpers from "helpers/stellar";
import { getAccount } from "services/stellar";
import { dataStorage } from "services/storage/storageFactory";

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

  it("should not add duplicate address", async () => {
    act(() => {
      store.setState({
        recentAddresses: [{ id: "recent-1", address: "existingAddress" }],
      });
    });

    await store.getState().addRecentAddress("existingAddress");

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
  });

  it("should handle invalid address format", async () => {
    (stellarHelpers.isValidStellarAddress as jest.Mock).mockReturnValue(false);

    await store.getState().searchAddress("invalid-address");

    expect(store.getState().searchError).toBe("Invalid Stellar address format");
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

    store.getState().reset();

    expect(store.getState().searchResults).toEqual([]);
    expect(store.getState().destinationAddress).toBe("");
    expect(store.getState().federationAddress).toBe("");
    expect(store.getState().isSearching).toBe(false);
    expect(store.getState().searchError).toBeNull();
    expect(store.getState().isValidDestination).toBe(false);
    expect(store.getState().isDestinationFunded).toBeNull();
  });
});
