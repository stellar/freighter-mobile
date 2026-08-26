/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Networks,
  Operation,
  OperationRecord,
  StrKey,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { render } from "@testing-library/react-native";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import { truncateAddress } from "helpers/stellar";
import React from "react";

// Render i18n keys verbatim so assertions target the value rows, not labels.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      text: { secondary: "#a0a0a0" },
      // Badge reads variant-specific palettes from themeColors.<color>[11]
      // (and gray[12] for its primary variant) when resolving text color —
      // include what the tertiary/cleared & deleted badges under test need
      // so the component doesn't throw while resolving.
      gray: { 9: "#8f8f8f", 11: "#8f8f8f", 12: "#707070" },
      lilac: { 11: "#aa00aa" },
      lime: { 11: "#00aa00" },
      amber: { 11: "#ffa000" },
      red: { 11: "#ff0000" },
    },
  }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "PUBLIC" }),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}));

jest.mock("services/blockaid/api", () => ({
  scanToken: jest.fn().mockResolvedValue(undefined),
}));

// Use the real number/asset formatting.
jest.mock("helpers/formatAmount", () =>
  jest.requireActual("helpers/formatAmount"),
);

const SOURCE = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";
const WBTC_ISSUER = "GD6ROJBYLKQMOW3E7N4M2YBPUHMZD7PL65VRHRMO24BOVSBV5H3BQRSL";
const WBTC = new Asset("WBTC", WBTC_ISSUER);
const XLM = Asset.native();
const USDC_ISSUER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
const USDC = new Asset("USDC", USDC_ISSUER);
const SIGNER_PUBLIC_KEY = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 5));
const FIND = { timeout: 3000 };
// react-i18next is mocked to echo the key, so labels render as their key path.
const label = (key: string) => `signTransactionDetails.operations.${key}`;

// Parse the operation the same way the signing flow does: read it back off a
// built transaction so the component receives a real parsed OperationRecord.
const operationsFor = (op: xdr.Operation): OperationRecord[] => {
  const account = new Account(SOURCE, "100");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();
  return tx.operations;
};

describe("SignTransactionDetails > Operations: offer amount denomination & price", () => {
  it("manageSellOffer renders a 'Selling Amount' row in the selling asset", async () => {
    const ops = operationsFor(
      Operation.manageSellOffer({
        selling: WBTC,
        buying: XLM,
        amount: "10.1234567",
        price: "1",
        offerId: "0",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("sellingAmount"), {}, FIND)).toBeTruthy();
    expect(await findByText("10.1234567 WBTC", {}, FIND)).toBeTruthy();
  });

  it("manageSellOffer renders the price as a buying/selling asset ratio", async () => {
    const ops = operationsFor(
      Operation.manageSellOffer({
        selling: WBTC,
        buying: XLM,
        amount: "10.1234567",
        price: "1",
        offerId: "0",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText("1.00 XLM / WBTC", {}, FIND)).toBeTruthy();
  });

  it("createPassiveSellOffer renders a 'Selling Amount' row in the selling asset", async () => {
    const ops = operationsFor(
      Operation.createPassiveSellOffer({
        selling: WBTC,
        buying: XLM,
        amount: "10.1234567",
        price: "1",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("sellingAmount"), {}, FIND)).toBeTruthy();
    expect(await findByText("10.1234567 WBTC", {}, FIND)).toBeTruthy();
  });

  it("createPassiveSellOffer renders the price as a buying/selling asset ratio", async () => {
    const ops = operationsFor(
      Operation.createPassiveSellOffer({
        selling: WBTC,
        buying: XLM,
        amount: "10.1234567",
        price: "1",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText("1.00 XLM / WBTC", {}, FIND)).toBeTruthy();
  });

  it("manageBuyOffer renders the price as a selling/buying asset ratio", async () => {
    const ops = operationsFor(
      Operation.manageBuyOffer({
        selling: WBTC,
        buying: XLM,
        buyAmount: "10.1234567",
        price: "3.5",
        offerId: "0",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText("3.50 WBTC / XLM", {}, FIND)).toBeTruthy();
  });

  it("manageBuyOffer renders a 'Buying Amount' row in the buying asset", async () => {
    const ops = operationsFor(
      Operation.manageBuyOffer({
        selling: WBTC,
        buying: XLM,
        buyAmount: "10.1234567",
        price: "3.5",
        offerId: "0",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("buyingAmount"), {}, FIND)).toBeTruthy();
    expect(await findByText("10.1234567 XLM", {}, FIND)).toBeTruthy();
  });
});

describe("SignTransactionDetails > Operations: setOptions presence checks & master-key warning", () => {
  it("masterWeight: 0 renders the row, its value, and the master-key warning (not an empty operation)", async () => {
    const ops = operationsFor(Operation.setOptions({ masterWeight: 0 }));

    const { findByText, getByTestId } = render(<Operations operations={ops} />);

    expect(await findByText(label("masterWeight"), {}, FIND)).toBeTruthy();
    expect(await findByText("0", {}, FIND)).toBeTruthy();
    expect(getByTestId("MasterKeyDisableWarning")).toBeTruthy();
  });

  it("CASE-2 takeover: masterWeight + all thresholds set to 0 alongside a new signer all render, plus the warning", async () => {
    const ops = operationsFor(
      Operation.setOptions({
        masterWeight: 0,
        lowThreshold: 0,
        medThreshold: 0,
        highThreshold: 0,
        signer: { ed25519PublicKey: SIGNER_PUBLIC_KEY, weight: 1 },
      }),
    );

    const { findByText, findAllByText, getByTestId } = render(
      <Operations operations={ops} />,
    );

    expect(await findByText(label("masterWeight"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("lowThreshold"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("mediumThreshold"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("highThreshold"), {}, FIND)).toBeTruthy();
    const zeros = await findAllByText("0", {}, FIND);
    expect(zeros.length).toBe(4);
    // KeyValueSigner renders via KeyVal.tsx's own i18next `t` (not the
    // react-i18next mock this file uses), so its label doesn't echo the key
    // path here -- assert on the truncated signer address it renders instead.
    expect(
      await findByText(truncateAddress(SIGNER_PUBLIC_KEY), {}, FIND),
    ).toBeTruthy();
    expect(getByTestId("MasterKeyDisableWarning")).toBeTruthy();
  });

  it("non-zero masterWeight/highThreshold render their values and do NOT show the master-key warning", async () => {
    const ops = operationsFor(
      Operation.setOptions({ masterWeight: 2, highThreshold: 3 }),
    );

    const { findByText, queryByTestId } = render(
      <Operations operations={ops} />,
    );

    expect(await findByText("2", {}, FIND)).toBeTruthy();
    expect(await findByText("3", {}, FIND)).toBeTruthy();
    expect(queryByTestId("MasterKeyDisableWarning")).toBeNull();
  });

  it("homeDomain: '' renders the row with a Cleared badge", async () => {
    const ops = operationsFor(Operation.setOptions({ homeDomain: "" }));

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("homeDomain"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("cleared"), {}, FIND)).toBeTruthy();
  });

  it("setFlags decodes a combined bitmask (REQUIRED | IMMUTABLE)", async () => {
    const ops = operationsFor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Operation.setOptions({ setFlags: 5 as any }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("setFlags"), {}, FIND)).toBeTruthy();
    expect(
      await findByText(
        "Authorization Required, Authorization Immutable",
        {},
        FIND,
      ),
    ).toBeTruthy();
  });

  it("clearFlags decodes a combined bitmask (REQUIRED | REVOCABLE)", async () => {
    const ops = operationsFor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Operation.setOptions({ clearFlags: 3 as any }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("clearFlags"), {}, FIND)).toBeTruthy();
    expect(
      await findByText(
        "Authorization Required, Authorization Revocable",
        {},
        FIND,
      ),
    ).toBeTruthy();
  });

  it("setFlags: 0 discloses the raw value instead of a blank row", async () => {
    const ops = operationsFor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Operation.setOptions({ setFlags: 0 as any }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("setFlags"), {}, FIND)).toBeTruthy();
    // A present-but-zero mask must not render an empty value.
    expect(await findByText("0", {}, FIND)).toBeTruthy();
  });

  it("setFlags with an unrecognized high bit still decodes the known flag and an unknown remainder", async () => {
    // REQUIRED (1) | high bit (0x80000000). The high bit must surface as an
    // unknown remainder, not be lost to signed-int coercion.
    const ops = operationsFor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Operation.setOptions({ setFlags: 0x80000001 as any }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    // The mocked t() drops interpolation, so the unknown-bits value can't be
    // asserted here; assert the known flag and that an unknown-remainder row is
    // emitted (proving the high bit wasn't silently dropped).
    expect(
      await findByText(/Authorization Required.*unknownFlags/, {}, FIND),
    ).toBeTruthy();
  });
});

describe("SignTransactionDetails > Operations: manageData presence checks", () => {
  it("value: null (deletion) renders the Value row with a Deleted badge", async () => {
    const ops = operationsFor(Operation.manageData({ name: "k", value: null }));

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("value"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("deleted"), {}, FIND)).toBeTruthy();
  });

  it("value: '' (empty, not a deletion) still renders the Value row", async () => {
    const ops = operationsFor(Operation.manageData({ name: "k", value: "" }));

    const { findByText, queryByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("value"), {}, FIND)).toBeTruthy();
    expect(queryByText(label("deleted"))).toBeNull();
  });
});

describe("SignTransactionDetails > Operations: setTrustLineFlags presence checks", () => {
  it("flags.authorized: false renders the row as Disabled (not hidden)", async () => {
    const ops = operationsFor(
      Operation.setTrustLineFlags({
        trustor: SOURCE,
        asset: WBTC,
        flags: { authorized: false },
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("flags.authorized"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("disabled"), {}, FIND)).toBeTruthy();
  });

  it("flags.authorized: true renders the row as Enabled", async () => {
    const ops = operationsFor(
      Operation.setTrustLineFlags({
        trustor: SOURCE,
        asset: WBTC,
        flags: { authorized: true },
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("flags.authorized"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("enabled"), {}, FIND)).toBeTruthy();
  });
});

describe("SignTransactionDetails > Operations: asset issuer disclosure", () => {
  it("payment of a non-native asset renders the token issuer", async () => {
    const ops = operationsFor(
      Operation.payment({
        destination: SOURCE,
        asset: USDC,
        amount: "10",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("tokenIssuer"), {}, FIND)).toBeTruthy();
  });

  it("payment of native XLM does NOT render a token issuer row", async () => {
    const ops = operationsFor(
      Operation.payment({
        destination: SOURCE,
        asset: XLM,
        amount: "10",
      }),
    );

    const { findByText, queryByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("tokenCode"), {}, FIND)).toBeTruthy();
    expect(queryByText(label("tokenIssuer"))).toBeNull();
  });

  it("manageSellOffer with a non-native buying asset renders the token issuer", async () => {
    const ops = operationsFor(
      Operation.manageSellOffer({
        selling: XLM,
        buying: USDC,
        amount: "1",
        price: "1",
        offerId: "0",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("tokenIssuer"), {}, FIND)).toBeTruthy();
  });

  it("revokeTrustlineSponsorship renders the token issuer for a non-native asset", async () => {
    const ops = operationsFor(
      Operation.revokeTrustlineSponsorship({
        account: SOURCE,
        asset: WBTC,
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("tokenCode"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("tokenIssuer"), {}, FIND)).toBeTruthy();
  });
});

describe("SignTransactionDetails > Operations: contract creation executables", () => {
  // KeyVal labels come from i18next's bare `t` (not react-i18next's hook), which
  // is not initialised here, so these assertions target rendered values.
  const OWNER_CONTRACT =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

  it("renders the wasm hash for a wasm executable and no external-executable note", async () => {
    const ops = operationsFor(
      Operation.createCustomContract({
        address: new Address(SOURCE),
        wasmHash: Buffer.alloc(32, 9),
        salt: Buffer.alloc(32, 1),
      }),
    );

    const { findByText, queryByTestId, queryByText } = render(
      <Operations operations={ops} />,
    );

    expect(await findByText("contractExecutableWasm", {}, FIND)).toBeTruthy();
    expect(
      await findByText(truncateAddress("09".repeat(32)), {}, FIND),
    ).toBeTruthy();
    expect(queryByTestId("ExternalExecutableNote")).toBeNull();
    expect(queryByText(truncateAddress(OWNER_CONTRACT))).toBeNull();
  });

  it("renders owner, tag and the note for a CAP-85 external executable (Protocol 28), and no wasm hash", async () => {
    const ops = operationsFor(
      Operation.createCustomContract({
        address: new Address(SOURCE),
        externalRef: { owner: OWNER_CONTRACT, tag: "token-v2" },
        salt: Buffer.alloc(32, 1),
      }),
    );

    const { findByText, findByTestId, queryByText } = render(
      <Operations operations={ops} />,
    );

    expect(
      await findByText("contractExecutableExternalRef", {}, FIND),
    ).toBeTruthy();
    expect(
      await findByText(truncateAddress(OWNER_CONTRACT), {}, FIND),
    ).toBeTruthy();
    expect(await findByText("token-v2", {}, FIND)).toBeTruthy();
    expect(await findByTestId("ExternalExecutableNote", {}, FIND)).toBeTruthy();
    // An external reference deliberately carries no wasm hash.
    expect(queryByText("contractExecutableWasm")).toBeNull();
  });
});

describe("SignTransactionDetails > Operations: hash-based signer keys", () => {
  // SDK 17 decodes revokeSignerSponsorship signer hashes to hex *strings* but
  // setOptions signer hashes to Uint8Arrays; both must render as the same
  // uppercase hex (and never re-hex the string or throw).
  const HASH_HEX = "ab".repeat(32);
  const HASH_UPPER = HASH_HEX.toUpperCase();

  it("revokeSignerSponsorship with a sha256Hash signer renders the hash as uppercase hex", async () => {
    const ops = operationsFor(
      Operation.revokeSignerSponsorship({
        account: SOURCE,
        signer: { sha256Hash: HASH_HEX },
      }),
    );

    const { findByText, queryByText } = render(<Operations operations={ops} />);

    expect(await findByText(HASH_UPPER, {}, FIND)).toBeTruthy();
    // the old Buffer.from(<hex string>) path rendered the hex of the ASCII
    expect(queryByText(Buffer.from(HASH_HEX).toString("hex"))).toBeNull();
  });

  it("revokeSignerSponsorship with a preAuthTx signer renders the hash as uppercase hex", async () => {
    const ops = operationsFor(
      Operation.revokeSignerSponsorship({
        account: SOURCE,
        signer: { preAuthTx: HASH_HEX },
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(HASH_UPPER, {}, FIND)).toBeTruthy();
  });

  it("setOptions with a sha256Hash signer (decoded as bytes) renders the same uppercase hex", async () => {
    const ops = operationsFor(
      Operation.setOptions({
        signer: { sha256Hash: Buffer.from(HASH_HEX, "hex"), weight: 1 },
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    // setOptions renders its signer through the truncating hash row
    expect(
      await findByText(truncateAddress(HASH_UPPER), {}, FIND),
    ).toBeTruthy();
  });
});
