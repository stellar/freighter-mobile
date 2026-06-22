/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  Account,
  Asset,
  BASE_FEE,
  Networks,
  Operation,
  OperationRecord,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { render } from "@testing-library/react-native";
import Operations from "components/screens/SignTransactionDetails/components/Operations";
import React from "react";

// Render i18n keys verbatim so assertions target the value rows, not labels.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: { text: { secondary: "#a0a0a0" }, gray: { 9: "#8f8f8f" } },
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
const FIND = { timeout: 3000 };

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
  it("manageSellOffer renders the amount in the SELLING asset", async () => {
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

  it("createPassiveSellOffer renders the amount in the SELLING asset", async () => {
    const ops = operationsFor(
      Operation.createPassiveSellOffer({
        selling: WBTC,
        buying: XLM,
        amount: "10.1234567",
        price: "1",
      }),
    );

    const { findByText } = render(<Operations operations={ops} />);

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

  it("manageBuyOffer keeps the buy amount in the BUYING asset", async () => {
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

    expect(await findByText("10.1234567 XLM", {}, FIND)).toBeTruthy();
  });
});
