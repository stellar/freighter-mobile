/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  Account,
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

    const { findByText, getByTestId } = render(
      <Operations operations={ops} />,
    );

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
});

describe("SignTransactionDetails > Operations: manageData presence checks", () => {
  it("value: null (deletion) renders the Value row with a Deleted badge", async () => {
    const ops = operationsFor(
      Operation.manageData({ name: "k", value: null }),
    );

    const { findByText } = render(<Operations operations={ops} />);

    expect(await findByText(label("value"), {}, FIND)).toBeTruthy();
    expect(await findByText(label("deleted"), {}, FIND)).toBeTruthy();
  });

  it("value: '' (empty, not a deletion) still renders the Value row", async () => {
    const ops = operationsFor(Operation.manageData({ name: "k", value: "" }));

    const { findByText, queryByText } = render(
      <Operations operations={ops} />,
    );

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

    expect(
      await findByText(label("flags.authorized"), {}, FIND),
    ).toBeTruthy();
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

    expect(
      await findByText(label("flags.authorized"), {}, FIND),
    ).toBeTruthy();
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

    const { findByText, queryByText } = render(
      <Operations operations={ops} />,
    );

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
