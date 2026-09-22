import { renderHook, waitFor } from "@testing-library/react-native";
import { useContractArgNames } from "components/screens/SignTransactionDetails/components/KeyVal";
import { ContractSpecSchema } from "helpers/soroban";
import { getContractSpecs } from "services/backend";

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "PUBLIC" }),
}));

jest.mock("services/backend", () => ({
  getContractSpecs: jest.fn(),
}));

const CONTRACT_A = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const CONTRACT_B = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const specFor = (fnName: string, argNames: string[]): ContractSpecSchema => ({
  definitions: {
    [fnName]: {
      properties: {
        args: {
          properties: Object.fromEntries(argNames.map((name) => [name, {}])),
          required: argNames,
        },
      },
    },
  },
});

const TRANSFER_SPEC = specFor("transfer", ["from", "to"]);

describe("useContractArgNames", () => {
  const getContractSpecsMock = getContractSpecs as jest.MockedFunction<
    typeof getContractSpecs
  >;

  beforeEach(() => {
    getContractSpecsMock.mockReset();
  });

  // The names and the loading flag are reset together at the top of the
  // effect. If only the names were dropped, `(isLoading: false, argNames:
  // null)` would be indistinguishable from "the lookup finished and produced
  // nothing", so the rows would render unlabelled -- and the spec note would
  // disappear -- while a refetch was still in flight.
  it("returns to the loading state when the invocation changes", async () => {
    getContractSpecsMock
      .mockResolvedValueOnce(TRANSFER_SPEC)
      // Stays pending, so the in-flight state is observable.
      .mockImplementationOnce(() => new Promise<never>(() => {}));

    const { result, rerender } = renderHook(
      (props: { contractId: string; fnName: string; argCount: number }) =>
        useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          fnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.argNames).toEqual(["from", "to"]);

    rerender({ contractId: CONTRACT_B, fnName: "swap", argCount: 2 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.argNames).toBeNull();
  });

  // Dropping the names up front is deliberate: a name resolved for one
  // invocation must never outlive it. So a failed refetch settles on
  // unlabelled rows rather than resurrecting the names it already had.
  it("does not fall back to the previous names when a refetch fails", async () => {
    getContractSpecsMock
      .mockResolvedValueOnce(TRANSFER_SPEC)
      .mockRejectedValueOnce(new Error("no spec"));

    const { result, rerender } = renderHook(
      (props: { contractId: string; fnName: string; argCount: number }) =>
        useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          fnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() =>
      expect(result.current.argNames).toEqual(["from", "to"]),
    );

    rerender({ contractId: CONTRACT_B, fnName: "swap", argCount: 2 });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.argNames).toBeNull();
  });

  // The guarantee is about the render itself, not about the state after
  // effects have flushed. Resetting inside the effect would still satisfy the
  // assertions above -- `rerender` flushes effects before they run -- while
  // committing one frame that pairs the new invocation's values with the
  // previous one's names. So record what every render actually saw.
  it("never renders the previous invocation's names against a new one", async () => {
    getContractSpecsMock
      .mockResolvedValueOnce(TRANSFER_SPEC)
      // Stays pending, so any stale frame has time to be observed.
      .mockImplementationOnce(() => new Promise<never>(() => {}));

    const renders: Array<{ argNames: string[] | null; isLoading: boolean }> =
      [];

    const { result, rerender } = renderHook(
      (props: { contractId: string; fnName: string; argCount: number }) => {
        const current = useContractArgNames(props);
        renders.push({ ...current });
        return current;
      },
      {
        initialProps: {
          contractId: CONTRACT_A,
          fnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() =>
      expect(result.current.argNames).toEqual(["from", "to"]),
    );

    renders.length = 0;
    rerender({ contractId: CONTRACT_B, fnName: "swap", argCount: 2 });

    expect(renders.length).toBeGreaterThan(0);
    renders.forEach((render) => {
      expect(render.argNames).toBeNull();
      expect(render.isLoading).toBe(true);
    });
  });

  // An auth entry resolves nothing, so it has no in-flight state to report.
  // Reporting one anyway would flash a spinner over rows that are always
  // going to render unlabelled.
  it("never reports loading for an invocation it will not resolve", () => {
    const { result } = renderHook(() =>
      useContractArgNames({
        contractId: CONTRACT_A,
        fnName: "transfer",
        argCount: 2,
        isAuthEntry: true,
      }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.argNames).toBeNull();
    expect(getContractSpecsMock).not.toHaveBeenCalled();
  });

  // `isAuthEntry` is not part of the invocation key, so names resolved for the
  // operation view would survive a switch to an auth entry at the same
  // contract, function and arity -- spec labels on args that need not be the
  // function's declared parameters, which is what the flag exists to prevent.
  it("drops resolved names when the same invocation becomes an auth entry", async () => {
    getContractSpecsMock.mockResolvedValueOnce(TRANSFER_SPEC);

    const { result, rerender } = renderHook(
      (props: {
        contractId: string;
        fnName: string;
        argCount: number;
        isAuthEntry: boolean;
      }) => useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          fnName: "transfer",
          argCount: 2,
          isAuthEntry: false,
        },
      },
    );

    await waitFor(() =>
      expect(result.current.argNames).toEqual(["from", "to"]),
    );

    rerender({
      contractId: CONTRACT_A,
      fnName: "transfer",
      argCount: 2,
      isAuthEntry: true,
    });

    expect(result.current.argNames).toBeNull();
    // No spinner either: the rows are always going to render unlabelled.
    expect(result.current.isLoading).toBe(false);
    expect(getContractSpecsMock).toHaveBeenCalledTimes(1);
  });
});
