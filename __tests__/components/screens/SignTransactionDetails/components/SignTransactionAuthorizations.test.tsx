import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { fireEvent } from "@testing-library/react-native";
import SignTransactionAuthorizations from "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { getContractSpecs } from "services/backend";

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "PUBLIC" }),
}));

// A resolvable spec, so a fetch that happened would visibly label the rows.
jest.mock("services/backend", () => ({
  getContractSpecs: jest.fn(),
}));

const CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const SOURCE = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";

const contractFnInvocation = (fnName: string, args: xdr.ScVal[]) =>
  new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(CONTRACT).toScAddress(),
          functionName: fnName,
          args,
        }),
      ),
    subInvocations: [],
  });

describe("SignTransactionAuthorizations", () => {
  const getContractSpecsMock = getContractSpecs as jest.MockedFunction<
    typeof getContractSpecs
  >;

  beforeEach(() => {
    getContractSpecsMock.mockReset();
  });

  // An auth entry's args are not the function's declared parameters:
  // `require_auth_for_args` can substitute an arbitrary list under the same
  // contract and function name, at the same arity, so the length check in
  // `getContractFnArgNames` cannot catch the mismatch. The spec is therefore
  // never consulted here. See stellar/freighter#2196.
  it("never labels auth-entry args from the contract spec", async () => {
    // Would label all three rows if it were ever fetched.
    getContractSpecsMock.mockResolvedValue({
      definitions: {
        transfer: {
          properties: {
            args: {
              properties: { from: {}, to: {}, amount: {} },
              required: ["from", "to", "amount"],
            },
          },
        },
      },
    });

    const { findAllByTestId, getAllByTestId, getByText, queryByTestId } =
      renderWithProviders(
        <SignTransactionAuthorizations
          authEntries={[
            {
              invocation: contractFnInvocation("transfer", [
                new Address(SOURCE).toScVal(),
                new Address(CONTRACT).toScVal(),
                nativeToScVal(BigInt(100), { type: "i128" }),
              ]),
            },
          ]}
        />,
      );

    // The entry is collapsed by default, so the args are not mounted -- and an
    // unmounted row could not fetch a spec whether it was suppressed or not.
    fireEvent.press(getByText("transfer"));

    const keys = await findAllByTestId("ParameterKey", {}, { timeout: 3000 });

    expect(getContractSpecsMock).not.toHaveBeenCalled();
    expect(keys).toHaveLength(3);
    keys.forEach((node) => expect(node.props.children).toBeUndefined());
    // Nothing was labelled, so there is no spec claim to disclaim.
    expect(queryByTestId("ContractSpecNote")).toBeNull();
    // The values themselves still render.
    expect(getAllByTestId("ParameterValue")).toHaveLength(3);
  });
});
