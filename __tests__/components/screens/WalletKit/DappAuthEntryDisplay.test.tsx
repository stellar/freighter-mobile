import { Address, hash, Networks, xdr } from "@stellar/stellar-sdk";
import { DappAuthEntryDisplay } from "components/screens/WalletKit/DappAuthEntryDisplay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}));

const OWNER_CONTRACT =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const DEPLOYER = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";

/** Wraps a create-contract invocation in a legacy Soroban auth preimage. */
const buildEntryXdr = (
  executable: xdr.ContractExecutable,
  contractIdPreimage: xdr.ContractIdPreimage,
) => {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
        new xdr.CreateContractArgs({ contractIdPreimage, executable }),
      ),
    subInvocations: [],
  });
  return xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: new xdr.Hash(hash(Buffer.from(Networks.TESTNET))),
      nonce: BigInt(1),
      signatureExpirationLedger: 1000,
      invocation,
    }),
  ).toXdr("base64");
};

const addressPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
  new xdr.ContractIdPreimageFromAddress({
    address: new Address(DEPLOYER).toScAddress(),
    salt: new xdr.Uint256Bytes(Buffer.alloc(32, 7)),
  }),
);

describe("DappAuthEntryDisplay", () => {
  it("renders a CAP-85 external-executable creation with its owner, tag and note (Protocol 28)", () => {
    const entryXdr = buildEntryXdr(
      xdr.ContractExecutable.contractExecutableExternalRef(
        new xdr.ContractExecutableExternalRef({
          executableOwner: new Address(OWNER_CONTRACT).toScAddress(),
          tag: "token-v2",
        }),
      ),
      addressPreimage,
    );

    const { getByText, getByTestId, queryByText } = renderWithProviders(
      <DappAuthEntryDisplay entryXdr={entryXdr} expandAll />,
    );

    expect(
      getByText("signTransactionDetails.authorizations.contractCreation"),
    ).toBeTruthy();
    expect(
      getByText("signTransactionDetails.authorizations.executableOwner"),
    ).toBeTruthy();
    expect(getByText("token-v2")).toBeTruthy();
    expect(getByTestId("ExternalExecutableNote")).toBeTruthy();
    // An external reference deliberately carries no wasm hash.
    expect(
      queryByText("signTransactionDetails.operations.executableWasmHash"),
    ).toBeNull();
  });

  it("flags an invocation it cannot decode instead of crashing", () => {
    // wasm executable + asset preimage is decodable XDR but an invalid pairing
    const entryXdr = buildEntryXdr(
      xdr.ContractExecutable.contractExecutableWasm(
        new xdr.Hash(Buffer.alloc(32)),
      ),
      xdr.ContractIdPreimage.contractIdPreimageFromAsset(
        xdr.Asset.assetTypeNative(),
      ),
    );

    const { getByText, getByTestId } = renderWithProviders(
      <DappAuthEntryDisplay entryXdr={entryXdr} expandAll />,
    );

    expect(
      getByText("signTransactionDetails.authorizations.unrecognizedInvocation"),
    ).toBeTruthy();
    expect(getByTestId("UnrecognizedInvocationWarning")).toBeTruthy();
  });
});
