/* eslint-disable @fnando/consistent-import/consistent-import */
import { xdr } from "@stellar/stellar-sdk";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import { KeyValueInvokeHostFnArgs } from "components/screens/SignTransactionDetails/components/KeyVal";
import { useContractArgNames } from "components/screens/SignTransactionDetails/components/KeyVal";
import { ContractSpecSchema } from "helpers/soroban";
import React from "react";
import { getContractSpecs } from "services/backend";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("i18next", () => ({ t: (key: string) => key }));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      text: { secondary: "#a0a0a0" },
      gray: { 3: "#222222", 9: "#8f8f8f", 11: "#8f8f8f", 12: "#707070" },
      lilac: { 3: "#2a1a3a", 11: "#aa00aa" },
    },
  }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

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
      (props: { contractId: string; specFnName: string; argCount: number }) =>
        useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          specFnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.argNames).toEqual(["from", "to"]);

    rerender({ contractId: CONTRACT_B, specFnName: "swap", argCount: 2 });

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
      (props: { contractId: string; specFnName: string; argCount: number }) =>
        useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          specFnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() =>
      expect(result.current.argNames).toEqual(["from", "to"]),
    );

    rerender({ contractId: CONTRACT_B, specFnName: "swap", argCount: 2 });

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
      (props: { contractId: string; specFnName: string; argCount: number }) => {
        const current = useContractArgNames(props);
        renders.push({ ...current });
        return current;
      },
      {
        initialProps: {
          contractId: CONTRACT_A,
          specFnName: "transfer",
          argCount: 2,
        },
      },
    );

    await waitFor(() =>
      expect(result.current.argNames).toEqual(["from", "to"]),
    );

    renders.length = 0;
    rerender({ contractId: CONTRACT_B, specFnName: "swap", argCount: 2 });

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
        specFnName: "transfer",
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
        specFnName: string;
        argCount: number;
        isAuthEntry: boolean;
      }) => useContractArgNames(props),
      {
        initialProps: {
          contractId: CONTRACT_A,
          specFnName: "transfer",
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
      specFnName: "transfer",
      argCount: 2,
      isAuthEntry: true,
    });

    expect(result.current.argNames).toBeNull();
    // No spinner either: the rows are always going to render unlabelled.
    expect(result.current.isLoading).toBe(false);
    expect(getContractSpecsMock).toHaveBeenCalledTimes(1);
  });
});

const mapEntry = (key: xdr.ScVal, val: xdr.ScVal) =>
  new xdr.ScMapEntry({ key, val });

/** `{ 1: "from-u64", "1": "from-string" }` — the colliding-key fixture. */
const COLLIDING_MAP = xdr.ScVal.scvMap([
  mapEntry(xdr.ScVal.scvU64(BigInt(1)), xdr.ScVal.scvString("from-u64")),
  mapEntry(xdr.ScVal.scvString("1"), xdr.ScVal.scvString("from-string")),
]);

const renderArgs = (args: xdr.ScVal[]) =>
  render(<KeyValueInvokeHostFnArgs args={args} />);

describe("KeyValueInvokeHostFnArgs — signed value display", () => {
  beforeEach(() => {
    mockCopyToClipboard.mockClear();
    // No spec for these fixtures: the rows render unlabelled, which is what
    // keeps the block from sitting on a spinner forever.
    (getContractSpecs as jest.Mock).mockRejectedValue(new Error("no spec"));
  });

  it("renders every signed entry of a map with colliding keys", async () => {
    renderArgs([COLLIDING_MAP]);

    const value = await screen.findAllByTestId("ParameterValue");
    // Four scalars: both keys and both values. Decoding to a native object
    // would have collapsed the two keys into one entry.
    expect(screen.getAllByTestId(/^ScValToken-/)).toHaveLength(4);
    expect(value).toBeTruthy();
  });

  // `<Text>{false}</Text>` renders nothing, so this used to be a blank row.
  it("renders a signed false rather than an empty row", async () => {
    renderArgs([xdr.ScVal.scvBool(false)]);

    await screen.findAllByTestId("ParameterValue");
    expect(screen.getByTestId("ScValToken-0:0")).toHaveTextContent("false");
  });

  it("shows no type until a scalar is tapped", async () => {
    renderArgs([COLLIDING_MAP]);

    await screen.findAllByTestId("ParameterValue");
    expect(screen.queryAllByTestId(/^ScValTokenType-/)).toHaveLength(0);
  });

  it("reveals the arm a scalar was signed as when it is tapped", async () => {
    renderArgs([COLLIDING_MAP]);

    await screen.findAllByTestId("ParameterValue");
    fireEvent.press(screen.getByTestId("ScValToken-0:1"));

    expect(screen.getByTestId("ScValTokenType-0:1")).toHaveTextContent(
      "scvU64",
    );
  });

  // The whole point of the reveal: `u64(1)` and `string("1")` render as
  // different keys, and tapping says which is which.
  it("distinguishes a u64 key from a string key", async () => {
    renderArgs([COLLIDING_MAP]);

    await screen.findAllByTestId("ParameterValue");
    fireEvent.press(screen.getByTestId("ScValToken-0:1"));
    expect(screen.getByTestId("ScValTokenType-0:1")).toHaveTextContent(
      "scvU64",
    );

    fireEvent.press(screen.getByTestId("ScValToken-0:5"));
    expect(screen.getByTestId("ScValTokenType-0:5")).toHaveTextContent(
      "scvString",
    );
  });

  it("dismisses the type when the same scalar is tapped again", async () => {
    renderArgs([COLLIDING_MAP]);

    await screen.findAllByTestId("ParameterValue");
    fireEvent.press(screen.getByTestId("ScValToken-0:1"));
    fireEvent.press(screen.getByTestId("ScValToken-0:1"));

    expect(screen.queryAllByTestId(/^ScValTokenType-/)).toHaveLength(0);
  });

  it("keeps at most one type revealed across the whole parameter block", async () => {
    renderArgs([COLLIDING_MAP, xdr.ScVal.scvU32(9)]);

    await screen.findAllByTestId("ParameterValue");
    fireEvent.press(screen.getByTestId("ScValToken-0:1"));
    fireEvent.press(screen.getByTestId("ScValToken-1:0"));

    const revealed = screen.getAllByTestId(/^ScValTokenType-/);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toHaveTextContent("scvU32");
  });

  it("renders a single scalar as one tappable token", async () => {
    renderArgs([xdr.ScVal.scvU64(BigInt(42))]);

    await screen.findAllByTestId("ParameterValue");
    const tokens = screen.getAllByTestId(/^ScValToken-/);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toHaveTextContent("42");
  });

  // `args` comes from a dapp, so container size is adversarial input. Past the
  // interactivity threshold the literal still renders in full — only the
  // per-scalar tap targets are dropped.
  it("renders a very large container as inert text rather than thousands of tokens", async () => {
    const huge = xdr.ScVal.scvVec(
      Array.from({ length: 1200 }, (unused, i) => xdr.ScVal.scvU32(i)),
    );
    renderArgs([huge]);

    const [rendered] = await screen.findAllByTestId("ParameterValue");
    expect(screen.queryAllByTestId(/^ScValToken-/)).toHaveLength(0);
    // The literal still renders in full — the last signed entry is on screen.
    expect(rendered.props.children as string).toContain("1199");
  });

  it("copies the same text it draws, and copying reveals nothing", async () => {
    renderArgs([COLLIDING_MAP]);

    await screen.findAllByTestId("ParameterValue");
    fireEvent.press(screen.getByTestId("ScValCopy-0"));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      '{\n  1: "from-u64",\n  "1": "from-string"\n}',
    );
    expect(screen.queryAllByTestId(/^ScValTokenType-/)).toHaveLength(0);
  });
});
