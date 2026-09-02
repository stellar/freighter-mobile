import { act, renderHook } from "@testing-library/react-hooks";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import useTokenDetails from "hooks/useTokenDetails";

// Mock the logger
jest.mock("config/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

// Mock the soroban helper
jest.mock("helpers/soroban", () => ({
  isContractId: (value: string) => value.startsWith("C") && value.length === 56,
}));

// Mock the backend service
const mockGetTokenDetails = jest.fn();
jest.mock("services/backend", () => ({
  getTokenDetails: (params: {
    contractId: string;
    publicKey: string;
    network: NETWORKS;
  }) => mockGetTokenDetails(params),
}));

// Helper function to wait for promises to resolve
const flushPromises = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("useTokenDetails", () => {
  const mockPublicKey =
    "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP";
  const mockNetwork = NETWORKS.TESTNET;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return native token code for native token", () => {
    const { result } = renderHook(() =>
      useTokenDetails({
        tokenId: "native",
        tokenSymbol: "XLM",
        publicKey: mockPublicKey,
        network: mockNetwork,
      }),
    );

    expect(result.current.displayTitle).toBe(NATIVE_TOKEN_CODE);
    expect(result.current.actualTokenDetails).toBeNull();
  });

  it("should return token symbol for non-contract tokens", () => {
    const tokenSymbol = "USDC";
    const { result } = renderHook(() =>
      useTokenDetails({
        tokenId:
          "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        tokenSymbol,
        publicKey: mockPublicKey,
        network: mockNetwork,
      }),
    );

    expect(result.current.displayTitle).toBe(tokenSymbol);
    expect(result.current.actualTokenDetails).toBeNull();
  });

  it("should fetch and return contract token details", async () => {
    const contractId =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    const mockTokenDetails = {
      symbol: "TEST",
      name: "Test Token",
    };

    mockGetTokenDetails.mockResolvedValue(mockTokenDetails);

    const { result } = renderHook(() =>
      useTokenDetails({
        tokenId: contractId,
        tokenSymbol: "UNKNOWN",
        publicKey: mockPublicKey,
        network: mockNetwork,
      }),
    );

    // Initial state
    expect(result.current.displayTitle).toBe("UNKNOWN");
    expect(result.current.actualTokenDetails).toBeNull();

    // Wait for the async effect to complete
    await act(async () => {
      await flushPromises();
    });

    expect(mockGetTokenDetails).toHaveBeenCalledWith({
      contractId,
      publicKey: mockPublicKey,
      network: mockNetwork,
    });
    expect(result.current.displayTitle).toBe("TEST");
    expect(result.current.actualTokenDetails).toEqual(mockTokenDetails);
  });

  it("does not map a contract-reported 'native' symbol to XLM for a non-native contract", async () => {
    mockGetTokenDetails.mockResolvedValue({ symbol: "native", name: "Native" });
    const { result } = renderHook(() =>
      useTokenDetails({
        tokenId: "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT",
        tokenSymbol: "FOO",
        publicKey: mockPublicKey,
        network: mockNetwork,
      }),
    );

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.actualTokenDetails).not.toBeNull();
    expect(result.current.actualTokenDetails?.symbol).toBe("native");
    expect(result.current.displayTitle).not.toBe("XLM");
  });

  it("maps the true native contract's 'native' symbol to XLM", async () => {
    mockGetTokenDetails.mockResolvedValue({ symbol: "native", name: "native" });
    const { result } = renderHook(() =>
      useTokenDetails({
        tokenId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        tokenSymbol: "XLM",
        publicKey: mockPublicKey,
        network: mockNetwork,
      }),
    );

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.actualTokenDetails).not.toBeNull();
    expect(result.current.actualTokenDetails?.symbol).toBe("XLM");
  });
});
