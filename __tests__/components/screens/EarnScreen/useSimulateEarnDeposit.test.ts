/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook, act } from "@testing-library/react-hooks";
import { useSimulateEarnDeposit } from "components/screens/EarnScreen/hooks/useSimulateEarnDeposit";
import { NETWORKS } from "config/constants";

const mockBuildBlendDepositTransaction = jest.fn();
const mockScanTransaction = jest.fn();
const mockGetBuilderState = jest.fn();

jest.mock("ducks/transactionBuilder", () => ({
  // The state object is built fresh on every call (not once at module-require
  // time), so it always reflects the current mock fns — matching how the
  // real zustand hook re-reads live state on every render.
  useTransactionBuilderStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        buildBlendDepositTransaction: mockBuildBlendDepositTransaction,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => mockGetBuilderState(),
    },
  ),
}));

jest.mock("hooks/blockaid/useBlockaidTransaction", () => ({
  useBlockaidTransaction: () => ({ scanTransaction: mockScanTransaction }),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));

const baseParams: Parameters<
  ReturnType<typeof useSimulateEarnDeposit>["simulate"]
>[0] = {
  assetId: "CASSET",
  amount: "10",
  decimals: 7,
  transactionFee: "0.00001",
  transactionTimeout: 30,
  network: NETWORKS.TESTNET,
  senderAddress: "GSENDER",
};

describe("useSimulateEarnDeposit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBuilderState.mockReturnValue({ error: null });
  });

  it("returns the prepared XDR and scan result on a clean success", async () => {
    mockBuildBlendDepositTransaction.mockResolvedValue("prepared-xdr");
    mockScanTransaction.mockResolvedValue({ scanned: true });

    const { result } = renderHook(() => useSimulateEarnDeposit());

    let outcome;
    await act(async () => {
      outcome = await result.current.simulate(baseParams);
    });

    expect(outcome).toEqual({
      preparedXdr: "prepared-xdr",
      scanResult: { scanned: true },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isSimulating).toBe(false);
    expect(mockScanTransaction).toHaveBeenCalledWith(
      "prepared-xdr",
      "internal",
    );
  });

  // This is the load-bearing regression test: `scanTransaction` throws
  // NETWORK_NOT_SUPPORTED on any non-mainnet network (i.e. every TESTNET
  // deposit). The scan failure must degrade to "unable to scan"
  // (`scanResult: undefined`) and must NOT fail the simulation itself —
  // otherwise every testnet deposit would report "simulation failed" when
  // only the security scan was unavailable.
  it("does not fail the simulation when the Blockaid scan throws (e.g. testnet)", async () => {
    mockBuildBlendDepositTransaction.mockResolvedValue("prepared-xdr");
    mockScanTransaction.mockRejectedValue(new Error("NETWORK_NOT_SUPPORTED"));

    const { result } = renderHook(() => useSimulateEarnDeposit());

    let outcome;
    await act(async () => {
      outcome = await result.current.simulate(baseParams);
    });

    expect(outcome).toEqual({
      preparedXdr: "prepared-xdr",
      scanResult: undefined,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.scanResult).toBeUndefined();
  });

  it("surfaces the builder store's own error message when the build fails", async () => {
    mockBuildBlendDepositTransaction.mockResolvedValue(null);
    mockGetBuilderState.mockReturnValue({
      error: "Supply cap exceeded for this reserve",
    });

    const { result } = renderHook(() => useSimulateEarnDeposit());

    let outcome;
    await act(async () => {
      outcome = await result.current.simulate(baseParams);
    });

    expect(outcome).toBeNull();
    expect(result.current.error).toBe("Supply cap exceeded for this reserve");
    expect(mockScanTransaction).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the build fails with no stored error", async () => {
    mockBuildBlendDepositTransaction.mockResolvedValue(null);
    mockGetBuilderState.mockReturnValue({ error: null });

    const { result } = renderHook(() => useSimulateEarnDeposit());

    let outcome;
    await act(async () => {
      outcome = await result.current.simulate(baseParams);
    });

    expect(outcome).toBeNull();
    expect(result.current.error).toBe("earnAmount.errors.simulationFailed");
  });

  it("resets isSimulating to false after settling", async () => {
    mockBuildBlendDepositTransaction.mockResolvedValue("prepared-xdr");
    mockScanTransaction.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSimulateEarnDeposit());

    await act(async () => {
      await result.current.simulate(baseParams);
    });

    expect(result.current.isSimulating).toBe(false);
  });
});
