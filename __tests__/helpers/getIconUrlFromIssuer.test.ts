import { Horizon, StellarToml, StrKey, Networks } from "@stellar/stellar-sdk";
import {
  NetworkDetails,
  NETWORKS,
  NETWORK_NAMES,
  NETWORK_URLS,
} from "config/constants";
import { getIconUrlFromIssuer } from "helpers/getIconUrlFromIssuer";

// Create a mock server instance that can be reused across tests
const mockLoadAccount = jest.fn();
const mockServer = {
  loadAccount: mockLoadAccount,
};

// Mock dependencies
jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => mockServer),
  },
  StellarToml: {
    Resolver: {
      resolve: jest.fn(),
    },
  },
  StrKey: {
    isValidEd25519PublicKey: jest.fn(),
  },
  Networks: {
    TESTNET: "Test SDF Network ; September 2015",
  },
}));

// Mock debug function
jest.mock("helpers/debug", () => ({
  debug: jest.fn(),
}));

// Disable the specific ESLint rule for this file
/* eslint-disable @typescript-eslint/unbound-method */

describe("getIconUrlFromIssuer", () => {
  // Test constants
  const validIssuerKey =
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const assetCode = "USDC";
  const testNetworkDetails: NetworkDetails = {
    network: NETWORKS.TESTNET,
    networkName: NETWORK_NAMES.TESTNET,
    networkUrl: NETWORK_URLS.TESTNET,
    networkPassphrase: Networks.TESTNET,
  };
  const imageUrl = "https://example.com/usdc.png";
  const homeDomain = "example.com";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return icon URL when all steps succeed", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockResolvedValue({
      CURRENCIES: [
        {
          code: assetCode,
          issuer: validIssuerKey,
          image: imageUrl,
        },
      ],
    });

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe(imageUrl);
    expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(validIssuerKey);
    expect(Horizon.Server).toHaveBeenCalledWith(testNetworkDetails.networkUrl);
    expect(mockLoadAccount).toHaveBeenCalledWith(validIssuerKey);
    expect(StellarToml.Resolver.resolve).toHaveBeenCalledWith(homeDomain);
  });

  it("should return empty string for invalid issuer key", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(false);

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: "invalid-key",
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
    expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith("invalid-key");
    expect(mockLoadAccount).not.toHaveBeenCalled();
  });

  it("should return empty string when loadAccount fails", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockRejectedValue(new Error("Network error"));

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
    expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(validIssuerKey);
    expect(Horizon.Server).toHaveBeenCalledWith(testNetworkDetails.networkUrl);
    expect(mockLoadAccount).toHaveBeenCalledWith(validIssuerKey);
  });

  it("should return empty string when no home domain is found", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: undefined });

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
    expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(validIssuerKey);
    expect(Horizon.Server).toHaveBeenCalledWith(testNetworkDetails.networkUrl);
    expect(mockLoadAccount).toHaveBeenCalledWith(validIssuerKey);
    expect(StellarToml.Resolver.resolve).not.toHaveBeenCalled();
  });

  it("should return empty string when toml resolution fails", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockRejectedValue(
      new Error("Failed to resolve TOML"),
    );

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
    expect(StrKey.isValidEd25519PublicKey).toHaveBeenCalledWith(validIssuerKey);
    expect(Horizon.Server).toHaveBeenCalledWith(testNetworkDetails.networkUrl);
    expect(mockLoadAccount).toHaveBeenCalledWith(validIssuerKey);
    expect(StellarToml.Resolver.resolve).toHaveBeenCalledWith(homeDomain);
  });

  it("should return empty string when toml has no CURRENCIES", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockResolvedValue({});

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
    expect(StellarToml.Resolver.resolve).toHaveBeenCalledWith(homeDomain);
  });

  it("should return empty string when no matching currency is found", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockResolvedValue({
      CURRENCIES: [
        {
          code: "DIFFERENT_ASSET",
          issuer: validIssuerKey,
          image: imageUrl,
        },
      ],
    });

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
  });

  it("should return empty string when currency has no image", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockResolvedValue({
      CURRENCIES: [
        {
          code: assetCode,
          issuer: validIssuerKey,
          image: undefined,
        },
      ],
    });

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe("");
  });

  it("should find the matching currency among multiple currencies", async () => {
    // Arrange
    (StrKey.isValidEd25519PublicKey as jest.Mock).mockReturnValue(true);
    mockLoadAccount.mockResolvedValue({ home_domain: homeDomain });
    (StellarToml.Resolver.resolve as jest.Mock).mockResolvedValue({
      CURRENCIES: [
        {
          code: "USD",
          issuer: "OTHER_ISSUER",
          image: "https://example.com/usd.png",
        },
        {
          code: assetCode,
          issuer: validIssuerKey,
          image: imageUrl,
        },
        {
          code: "EUR",
          issuer: "ANOTHER_ISSUER",
          image: "https://example.com/eur.png",
        },
      ],
    });

    // Act
    const result = await getIconUrlFromIssuer({
      issuerKey: validIssuerKey,
      assetCode,
      networkDetails: testNetworkDetails,
    });

    // Assert
    expect(result).toBe(imageUrl);
  });
});

// Re-enable the ESLint rule for code after this file
/* eslint-enable @typescript-eslint/unbound-method */
