/* eslint-disable @fnando/consistent-import/consistent-import */
// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous). Mirrors the pattern in
// __tests__/ducks/getUserFacingError.test.ts.
import {
  collectTokenIds,
  mapV2Transaction,
  MapV2Context,
} from "helpers/history/v2";
import { buildPresentation } from "helpers/history/v2/classify";
import { BalanceChangeRow, ResolvedToken } from "helpers/history/v2/model";
import { TokenContext } from "helpers/history/v2/tokenResolver";
import { getDeviceLanguage } from "helpers/localeUtils";
import "i18n";

import {
  MOCK_SELF as REAL_ACCOUNT,
  MOCK_XLM_SAC as REAL_XLM_SAC,
  MOCK_YUSDC_SAC as REAL_YUSDC_SAC,
  MOCK_BLND_SAC as REAL_BLND_SAC,
  MOCK_CETES_SAC as REAL_CETES_SAC,
  mockHistoryTransactions,
} from "../../../../__mocks__/services/fixtures/historyV2";
import {
  MOCK_ACCOUNT_2,
  MOCK_EURC_SAC,
  MOCK_EXTERNAL,
  MOCK_MUXED_ACCOUNT_2,
  MOCK_MUXED_SELF,
  MOCK_ROUTER_CONTRACT,
  MOCK_SELF,
  MOCK_USDC_SAC,
  MOCK_XLM_SAC,
  mockAccountCreated,
  mockAccountMerged,
  mockBalanceAuthChanged,
  mockClaimableBalanceClaimed,
  mockClaimableBalanceCreatedBySelf,
  mockClassicBatch,
  mockContractMultiAsset,
  mockContractNoBalanceChange,
  mockDataEntryAdded,
  mockDataEntryMulti,
  mockFailedTransaction,
  mockFlagsChanged,
  mockHeterogeneousBatch,
  mockHomeDomainUpdated,
  mockLpDeposit,
  mockLpWithdraw,
  mockOfferCrossed,
  mockPathPaymentMultiRow,
  mockPaymentReceived,
  mockPaymentReceivedMuxed,
  mockPaymentSent,
  mockSponsorshipOperation,
  mockAllowanceApproved,
  mockSignerAdded,
  mockSignerMulti,
  mockSwapClassicDex,
  mockSwapViaContract,
  mockThresholdsChange,
  mockTokenMintReceived,
  mockTokenMintToOther,
  mockTokenTransferReceived,
  mockTokenTransferReceivedMuxed,
  mockTokenTransferSent,
  mockTokenTransferSentMuxed,
  mockTokenTransferSentWithMuxedId,
  mockTrustlineAdded,
  mockTrustlineMulti,
  mockScenarioTransactions,
} from "../../../../__mocks__/services/fixtures/historyV2Scenarios";

// Mock the OS locale detection for consistent test behavior, matching the
// pattern used elsewhere in this repo (e.g.
// __tests__/components/screens/HistoryScreen.test.tsx). Only the "locale-aware
// amount formatting" describe block below overrides this (once, via
// mockReturnValueOnce) to prove classify.ts's formatAmount/trimTrailingZeros
// call order is correct under a comma-decimal device locale — every other
// test in this file runs under the default "en" mock, which behaves
// identically to the real device locale this suite already ran under before
// this mock was added.
jest.mock("helpers/localeUtils", () => ({
  getDeviceLanguage: jest.fn().mockReturnValue("en"),
  isSupportedLanguage: jest.fn().mockReturnValue(true),
}));

const token = (
  code: string,
  contractId: string,
  icon: string | null = null,
): ResolvedToken => ({
  code,
  contractId,
  issuer: null,
  icon,
  decimals: 7,
});

const tokens: TokenContext = new Map([
  [MOCK_XLM_SAC, token("XLM", MOCK_XLM_SAC)],
  [MOCK_USDC_SAC, token("USDC", MOCK_USDC_SAC, "usdc.png")],
  [MOCK_EURC_SAC, token("EURC", MOCK_EURC_SAC)],
]);

const ctx: MapV2Context = {
  tokens,
  publicKey: MOCK_SELF,
  nativeTokenId: MOCK_XLM_SAC,
};

describe("collectTokenIds", () => {
  it("collects every token contract id referenced by a page", () => {
    const ids = collectTokenIds(mockScenarioTransactions);
    expect(ids).toEqual(
      expect.arrayContaining([MOCK_XLM_SAC, MOCK_USDC_SAC, MOCK_EURC_SAC]),
    );
  });
});

describe("mapV2Transaction", () => {
  it("maps a classic DEX swap", () => {
    const entry = mapV2Transaction(mockSwapClassicDex, ctx);

    expect(entry.kind).toBe("swapped");
    expect(entry.primaryText).toBe("XLM to USDC");
    expect(entry.secondaryText).toBe("Swapped");
    expect(entry.secondaryIcon).toBe("swap");
    expect(entry.rowIcon).toEqual({
      type: "asset",
      tokens: [tokens.get(MOCK_XLM_SAC), tokens.get(MOCK_USDC_SAC)],
    });
    expect(entry.amounts).toEqual([
      { text: "+40.4 USDC", direction: "credit" },
    ]);
    expect(entry.details.title).toBe("Swapped XLM to USDC");
    expect(entry.details.rate).toBe("1 XLM ≈ 1.01 USDC");
    expect(entry.details.fee).toBe("0.0051234");
    // fee entry excluded from display rows
    expect(entry.details.balanceChanges).toHaveLength(2);
    expect(entry.details.status).toBe("success");
  });

  it("maps a swap routed through an unknown contract with the fallback treatment", () => {
    const entry = mapV2Transaction(mockSwapViaContract, ctx);

    expect(entry.kind).toBe("swapped");
    // No protocol match yet — but the movement says what happened: the
    // classic pair treatment, whatever contract routed it.
    expect(entry.primaryText).toBe("XLM to USDC");
    expect(entry.secondaryText).toBe("Swapped");
    expect(entry.rowIcon.type).toBe("asset");
    expect(entry.details.title).toBe("Swapped XLM to USDC");
    expect(entry.details.contractId).toBe(MOCK_ROUTER_CONTRACT);
    expect(entry.details.functionName).toBe("swap");
    expect(entry.details.protocol).toBeNull();
    expect(entry.details.rate).toBe("1 XLM ≈ 1.01 USDC");
  });

  it("maps a multi-asset contract call to 'Multiple'", () => {
    const entry = mapV2Transaction(mockContractMultiAsset, ctx);

    expect(entry.kind).toBe("contract");
    expect(entry.amounts).toBe("multiple");
    // multi-asset movement has no single identity and invocation names stay
    // in the detail sheet — generic by design
    expect(entry.primaryText).toBe("Contract");
    // stacked icons over the distinct moved tokens (XLM, EURC, USDC)
    expect(entry.rowIcon).toEqual({
      type: "asset",
      tokens: [
        tokens.get(MOCK_XLM_SAC),
        tokens.get(MOCK_EURC_SAC),
        tokens.get(MOCK_USDC_SAC),
      ],
    });
    expect(entry.details.balanceChanges).toHaveLength(6);
  });

  it("maps a fee-only contract call", () => {
    const entry = mapV2Transaction(mockContractNoBalanceChange, ctx);

    expect(entry.kind).toBe("contract");
    expect(entry.amounts).toBeNull();
    // fee-only, so no movement to describe — generic by design (invocation
    // names stay in the detail sheet)
    expect(entry.primaryText).toBe("Contract");
    expect(entry.secondaryText).toBe("Interacted");
    expect(entry.rowIcon).toEqual({ type: "contract" });
    expect(entry.details.balanceChanges).toHaveLength(0);
    expect(entry.details.contractId).toBe(MOCK_USDC_SAC);
  });

  it("maps a received payment with its counterparty", () => {
    const entry = mapV2Transaction(mockPaymentReceived, ctx);

    expect(entry.kind).toBe("received");
    expect(entry.primaryText).toBe("USDC");
    expect(entry.secondaryText).toBe("Received");
    expect(entry.amounts).toEqual([
      { text: "+40.4 USDC", direction: "credit" },
    ]);
    expect(entry.details.title).toBe("Received USDC");
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
  });

  it("maps a sent payment with its counterparty", () => {
    const entry = mapV2Transaction(mockPaymentSent, ctx);

    expect(entry.kind).toBe("sent");
    expect(entry.primaryText).toBe("XLM");
    expect(entry.amounts).toEqual([{ text: "-100 XLM", direction: "debit" }]);
    expect(entry.details.title).toBe("Sent XLM");
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
  });

  it("maps a SEP-41 token transfer with the transfer destination", () => {
    const entry = mapV2Transaction(mockTokenTransferSent, ctx);

    expect(entry.kind).toBe("sent");
    expect(entry.details.functionName).toBe("transfer");
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
    expect(entry.amounts).toEqual([{ text: "-40.4 USDC", direction: "debit" }]);
    // a SEP-41 transfer IS a payment — identical row to the classic treatment
    expect(entry.primaryText).toBe("USDC");
    expect(entry.secondaryText).toBe("Sent");
    expect(entry.rowIcon.type).toBe("asset");
    expect(entry.details.title).toBe("Sent USDC");
  });

  it("maps an INCOMING SEP-41 transfer with the sender as counterparty, never self", () => {
    const entry = mapV2Transaction(mockTokenTransferReceived, ctx);

    expect(entry.kind).toBe("received");
    expect(entry.details.functionName).toBe("transfer");
    // The regression this guards: the counterparty used to short-circuit on
    // the transfer's `to` arg with no publicKey comparison, so a received
    // transfer rendered "From: <the user's own address>".
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
    expect(entry.details.counterparty).not.toBe(MOCK_SELF);
    expect(entry.amounts).toEqual([
      { text: "+40.4 USDC", direction: "credit" },
    ]);
    // the incoming half of the same rule: renders like a received payment
    expect(entry.primaryText).toBe("USDC");
    expect(entry.secondaryText).toBe("Received");
  });

  it("maps a SEP-41 mint to self with no counterparty (a mint has no sender)", () => {
    const entry = mapV2Transaction(mockTokenMintReceived, ctx);

    expect(entry.kind).toBe("received");
    expect(entry.details.functionName).toBe("mint");
    // mint(to, amount) has two args — getArgsForTokenInvocation used to read
    // args[2] unconditionally and throw, silently degrading every mint.
    expect(entry.details.counterparty).toBeNull();
    expect(entry.amounts).toEqual([
      { text: "+40.4 USDC", direction: "credit" },
    ]);
    // state changes drive: a mint's credit renders like a received payment
    // (invocation names stay in the detail sheet)
    expect(entry.primaryText).toBe("USDC");
    expect(entry.secondaryText).toBe("Received");
  });

  it("maps the admin's mint to another account with the recipient as counterparty", () => {
    const entry = mapV2Transaction(mockTokenMintToOther, ctx);

    expect(entry.details.functionName).toBe("mint");
    // The recipient at args[0]. Unlike mint-to-self (counterparty null either
    // way), this is only reachable when the 2-arg mint actually decodes — the
    // mapper-level guard on the old unconditional-args[2] throw.
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
  });

  it("keeps a real payment equal to fee_charged when the wire carries operation ids (sponsored/fee-bump)", () => {
    // A sponsored account pays no fee, so its state changes have no fee
    // entry — but the old amount heuristic still deleted the first native
    // debit equal to fee_charged, erasing the actual payment. The wire's
    // authoritative signal is operation_id: fee entries have none, real
    // movements do.
    const [payment] = mockPaymentSent.state_changes;
    const sponsored = {
      ...mockPaymentSent,
      state_changes: [
        // real payment (operation_id present) whose amount IS fee_charged
        { ...payment, amount: mockPaymentSent.fee_charged },
      ],
    };

    const entry = mapV2Transaction(sponsored, ctx);

    expect(entry.kind).toBe("sent");
    expect(entry.amounts).toEqual([
      { text: "-0.0051234 XLM", direction: "debit" },
    ]);
  });

  it("falls back to the amount heuristic on a wire that predates operation ids", () => {
    // No change in the tx carries an id — absence means nothing there, so
    // the fee is identified the old way (first native debit == fee_charged).
    const legacyWire = {
      ...mockPaymentSent,
      state_changes: mockPaymentSent.state_changes.map((change) => ({
        ...change,
        operation_id: undefined,
      })),
    };

    const entry = mapV2Transaction(legacyWire, ctx);

    // fee stripped, the real -100 XLM payment drives the row
    expect(entry.kind).toBe("sent");
    expect(entry.amounts).toEqual([{ text: "-100 XLM", direction: "debit" }]);
    expect(entry.details.balanceChanges).toHaveLength(1);
  });

  it("maps an incoming transfer addressed to the muxed form of self by base account", () => {
    const entry = mapV2Transaction(mockTokenTransferReceivedMuxed, ctx);

    expect(entry.kind).toBe("received");
    // The `to` arg is MOCK_MUXED_SELF (scAddressTypeMuxedAccount). A bare ===
    // against the G key misreads this as outgoing and returns the user's own
    // M-address as counterparty. Also proves the to_muxed_id upgrade is NOT
    // applied when the counterparty is the sender.
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
    expect(entry.details.counterparty).not.toBe(MOCK_MUXED_SELF);
  });

  it("keeps the muxed recipient verbatim on an outgoing transfer", () => {
    const entry = mapV2Transaction(mockTokenTransferSentMuxed, ctx);

    expect(entry.kind).toBe("sent");
    // Display preserves the M-address the user actually targeted.
    expect(entry.details.counterparty).toBe(MOCK_MUXED_ACCOUNT_2);
  });

  it("reconstructs the muxed recipient from to_muxed_id when the arg decoded bare (first consumer of the field)", () => {
    const entry = mapV2Transaction(mockTokenTransferSentWithMuxedId, ctx);

    expect(entry.kind).toBe("sent");
    // Bare-G `to` arg + to_muxed_id on the balance change → the CAP-67
    // reconstruction MuxedAccount(MOCK_ACCOUNT_2, 67890).
    expect(entry.details.counterparty).toBe(MOCK_MUXED_ACCOUNT_2);
  });

  it("maps a classic payment received at the muxed form of self with the sender as counterparty", () => {
    const entry = mapV2Transaction(mockPaymentReceivedMuxed, ctx);

    expect(entry.kind).toBe("received");
    // decodeCounterparty's destination comparison must normalize the muxed
    // destination to its base account; the counterparty is the op source.
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
    expect(entry.details.counterparty).not.toBe(MOCK_MUXED_SELF);
  });

  it("suppresses the companion balance-authorization change on a trustline event, but keeps standalone ones", () => {
    // Creating a trustline against a default-auth issuer emits a
    // BalanceAuthorizationChange(SET) companion; the design's trustline frame
    // shows only the trustline card, so the companion must not become a
    // second "Balance Authorized" card (mockTrustlineAdded carries it).
    const trustline = mapV2Transaction(mockTrustlineAdded, ctx);
    expect(
      trustline.details.stateChangeCards.filter(
        (card) => card.kind === "balanceAuthorizations",
      ),
    ).toHaveLength(0);

    // ...while an issuer's own SET_TRUST_LINE_FLAGS tx (no trustline change
    // in it) still renders the authorization card.
    const standalone = mapV2Transaction(mockBalanceAuthChanged, ctx);
    expect(
      standalone.details.stateChangeCards.filter(
        (card) => card.kind === "balanceAuthorizations",
      ),
    ).not.toHaveLength(0);
  });

  it("labels an LP deposit by its operation, never as Contract", () => {
    const entry = mapV2Transaction(mockLpDeposit, ctx);

    // Two same-direction debits "look like" a generic multi-asset contract
    // call — the regression that drove op-type-first dispatch. The op says
    // what it is.
    expect(entry.primaryText).toBe("Liquidity pool deposit");
    expect(entry.primaryText).not.toBe("Contract");
    expect(entry.secondaryText).toBe("Submitted");
    expect(entry.kind).toBe("other");
    // two assets moved → the Multiple label, never stacked amounts; the
    // per-asset breakdown is the detail sheet's job
    expect(entry.amounts).toBe("multiple");
    expect(entry.rowIcon).toEqual({
      type: "asset",
      tokens: [tokens.get(MOCK_XLM_SAC), tokens.get(MOCK_USDC_SAC)],
    });
    expect(entry.details.title).toBe("Liquidity pool deposit");
  });

  it("labels an LP withdrawal by its operation", () => {
    const entry = mapV2Transaction(mockLpWithdraw, ctx);

    expect(entry.primaryText).toBe("Liquidity pool withdrawal");
    expect(entry.amounts).toBe("multiple");
  });

  it("labels a claim as claimed, not as a received payment", () => {
    const entry = mapV2Transaction(mockClaimableBalanceClaimed, ctx);

    expect(entry.primaryText).toBe("Claimable balance claimed");
    expect(entry.secondaryText).toBe("Claimed");
    // kind stays shape-behavioral (dust filtering, sheet direction) — only
    // the labels are op-driven.
    expect(entry.kind).toBe("received");
    expect(entry.amounts).toEqual([
      { text: "+40.4 USDC", direction: "credit" },
    ]);
  });

  it("labels the creator side of a claimable balance as created, not as Sent", () => {
    const entry = mapV2Transaction(mockClaimableBalanceCreatedBySelf, ctx);

    expect(entry.primaryText).toBe("Claimable balance created");
    expect(entry.secondaryText).toBe("Pending claim");
    // The escrowed debit is a sheet detail, not the row's identity — nothing
    // has been received by anyone yet.
    expect(entry.amounts).toBeNull();
    expect(entry.details.balanceChanges).toHaveLength(1);
    expect(entry.details.balanceChanges[0].direction).toBe("debit");
  });

  it("labels a crossed offer as Offer, not as a swap", () => {
    const entry = mapV2Transaction(mockOfferCrossed, ctx);

    expect(entry.primaryText).toBe("Offer");
    expect(entry.secondaryText).toBe("Submitted");
    expect(entry.kind).toBe("other");
    // two assets filled → the Multiple label, not stacked amounts
    expect(entry.amounts).toBe("multiple");
  });

  it("labels a homogeneous payment batch by its operation — never a swap pair, never Contract", () => {
    const entry = mapV2Transaction(mockClassicBatch, ctx);

    // One debit + one credit is exactly a swap's shape, but the ops are two
    // ordinary payments, and homogeneous ops name themselves.
    expect(entry.primaryText).toBe("Payment");
    expect(entry.secondaryText).toBe("Multiple balance changes");
    expect(entry.kind).toBe("other");
    expect(entry.amounts).toBe("multiple");
  });

  it("labels a multi-row path payment as Path payment, never the generic Transaction", () => {
    const entry = mapV2Transaction(mockPathPaymentMultiRow, ctx);

    expect(entry.primaryText).toBe("Path payment");
    expect(entry.secondaryText).toBe("Multiple balance changes");
    expect(entry.amounts).toBe("multiple");
  });

  it("reserves the Transaction label for genuinely heterogeneous classic batches", () => {
    const entry = mapV2Transaction(mockHeterogeneousBatch, ctx);

    // PAYMENT + LIQUIDITY_POOL_DEPOSIT in one tx: no single operation
    // identity exists, so — and only so — the generic label is honest.
    expect(entry.primaryText).toBe("Transaction");
    expect(entry.secondaryText).toBe("Multiple balance changes");
  });

  it("maps a trustline added", () => {
    const entry = mapV2Transaction(mockTrustlineAdded, ctx);

    expect(entry.kind).toBe("trustlineAdded");
    expect(entry.primaryText).toBe("USDC");
    expect(entry.secondaryText).toBe("Added trustline");
    expect(entry.amounts).toBeNull();
    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "trustlines",
        verb: "created",
        entries: [
          {
            token: tokens.get(MOCK_USDC_SAC),
            limitOld: null,
            limitNew: "922337203685.4775807",
          },
        ],
      },
    ]);
  });

  it("groups multiple trustline changes by verb", () => {
    const entry = mapV2Transaction(mockTrustlineMulti, ctx);
    const cards = entry.details.stateChangeCards;

    expect(cards.map((c) => c.kind)).toEqual([
      "trustlines",
      "trustlines",
      "trustlines",
    ]);
    expect(cards).toEqual([
      expect.objectContaining({ verb: "created" }),
      expect.objectContaining({
        verb: "updated",
        entries: [
          expect.objectContaining({
            limitOld: "1000.0000000",
            limitNew: "10000.0000000",
          }),
        ],
      }),
      expect.objectContaining({ verb: "removed" }),
    ]);
  });

  it("maps account created with funder and starting balance", () => {
    const entry = mapV2Transaction(mockAccountCreated, ctx);

    // the starting-balance credit drives the row
    expect(entry.kind).toBe("received");
    expect(entry.amounts).toEqual([{ text: "+5 XLM", direction: "credit" }]);
    expect(entry.details.stateChangeCards).toEqual([
      { kind: "accountCreated", address: MOCK_SELF, funder: MOCK_EXTERNAL },
    ]);
  });

  it("maps account merged", () => {
    const entry = mapV2Transaction(mockAccountMerged, ctx);

    expect(entry.kind).toBe("received");
    expect(entry.amounts).toEqual([
      { text: "+123.45 XLM", direction: "credit" },
    ]);
    expect(entry.details.stateChangeCards).toEqual([{ kind: "accountMerged" }]);
    expect(entry.details.counterparty).toBe(MOCK_ACCOUNT_2);
  });

  it("maps a single signer added", () => {
    const entry = mapV2Transaction(mockSignerAdded, ctx);

    expect(entry.kind).toBe("other");
    expect(entry.primaryText).toBe("Signers");
    expect(entry.secondaryText).toBe("Signer added");
    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "signers",
        verb: "added",
        entries: [{ address: MOCK_ACCOUNT_2, weightOld: null, weightNew: 1 }],
      },
    ]);
  });

  it("groups multiple signer changes by verb, alongside a balance movement", () => {
    const entry = mapV2Transaction(mockSignerMulti, ctx);

    // the XLM debit drives the row
    expect(entry.kind).toBe("sent");
    expect(entry.amounts).toEqual([{ text: "-40 XLM", direction: "debit" }]);
    expect(entry.details.stateChangeCards).toEqual([
      expect.objectContaining({ kind: "signers", verb: "added" }),
      expect.objectContaining({
        kind: "signers",
        verb: "updated",
        entries: [expect.objectContaining({ weightOld: 1, weightNew: 2 })],
      }),
      expect.objectContaining({
        kind: "signers",
        verb: "removed",
        entries: [expect.objectContaining({ weightOld: 1, weightNew: null })],
      }),
    ]);
  });

  it("maps a threshold change with old → new values", () => {
    const entry = mapV2Transaction(mockThresholdsChange, ctx);

    expect(entry.details.stateChangeCards).toEqual([
      { kind: "thresholds", level: "medium", valueOld: "2", valueNew: "3" },
    ]);
  });

  it("maps a data entry added", () => {
    const entry = mapV2Transaction(mockDataEntryAdded, ctx);

    expect(entry.primaryText).toBe("Contract");
    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "dataEntry",
        verb: "added",
        entries: [
          {
            key: "hair_color",
            valueOldB64: null,
            valueNewB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
          },
        ],
      },
    ]);
  });

  it("maps multiple data entries with added/updated/removed verbs", () => {
    const entry = mapV2Transaction(mockDataEntryMulti, ctx);
    const cards = entry.details.stateChangeCards;

    // The tx is a contract invocation, so the row is titled by the contract —
    // the data entries are supporting cards, not the row's identity
    expect(entry.kind).toBe("contract");
    expect(entry.primaryText).toBe("Contract");
    expect(entry.details.title).toBe("Contract");

    // one card per verb, in added → updated → removed order
    expect(cards).toEqual([
      expect.objectContaining({
        verb: "added",
        entries: [expect.objectContaining({ key: "hair_color" })],
      }),
      expect.objectContaining({
        verb: "updated",
        entries: [
          {
            key: "eye_color",
            valueOldB64: "Ymx1ZQ==",
            valueNewB64: "Z3JlZW4=",
          },
        ],
      }),
      expect.objectContaining({
        verb: "removed",
        entries: [expect.objectContaining({ key: "shoe_size" })],
      }),
    ]);
  });

  it("maps a home domain update", () => {
    const entry = mapV2Transaction(mockHomeDomainUpdated, ctx);

    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "homeDomain",
        verb: "updated",
        domainOld: "stellar.org",
        domainNew: "stellar.com",
      },
    ]);
  });

  it("merges flag SET and CLEAR into one card", () => {
    const entry = mapV2Transaction(mockFlagsChanged, ctx);

    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "flags",
        set: ["AUTH_REVOCABLE"],
        cleared: ["AUTH_CLAWBACK_ENABLED"],
      },
    ]);
  });

  it("groups balance authorizations by direction", () => {
    const entry = mapV2Transaction(mockBalanceAuthChanged, ctx);

    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "balanceAuthorizations",
        authorized: true,
        tokens: [tokens.get(MOCK_USDC_SAC)],
      },
      {
        kind: "balanceAuthorizations",
        authorized: false,
        tokens: [tokens.get(MOCK_EURC_SAC)],
      },
    ]);
  });

  // Upstream stopped indexing sponsorship reserve changes, so the operation
  // carries no state changes of its own.
  it("maps a sponsorship operation with no state changes", () => {
    const entry = mapV2Transaction(mockSponsorshipOperation, ctx);

    expect(entry.details.stateChangeCards).toEqual([]);
    expect(entry.details.operations).toHaveLength(1);
    // nothing to describe but the operation itself
    expect(entry.primaryText).toBe("Sponsorship");
    expect(entry.secondaryText).toBe("Submitted");
  });

  it("maps an allowance approval", () => {
    const entry = mapV2Transaction(mockAllowanceApproved, ctx);

    expect(entry.details.stateChangeCards).toEqual([
      {
        kind: "allowance",
        token: tokens.get(MOCK_USDC_SAC),
        spender: MOCK_ROUTER_CONTRACT,
        amount: "100",
        expirationLedger: 51_530_000,
      },
    ]);
  });

  it("maps a failed transaction", () => {
    const entry = mapV2Transaction(mockFailedTransaction, ctx);

    expect(entry.kind).toBe("failed");
    expect(entry.primaryText).toBe("Transaction failed");
    expect(entry.secondaryIcon).toBe("failed");
    expect(entry.details.status).toBe("failed");
    expect(entry.details.title).toBe("Transaction failed");
    expect(entry.details.fee).toBe("0.0051234");
  });

  it("suppresses the protocol-action overlay when the transaction failed", () => {
    // buildPresentation must not relabel a failed row even when a protocol
    // action was resolved for it — failed suppresses the overlay entirely.
    const entry = buildPresentation({
      classification: { type: "none" },
      cards: [],
      protocol: null,
      failed: true,
      operationTypes: [],
      protocolAction: { label: "Claimed emissions", protocolName: "Blend" },
    });

    expect(entry.kind).toBe("failed");
    expect(entry.primaryText).toBe("Transaction failed");
    expect(entry.secondaryText).toBe("Failed");
    expect(entry.secondaryIcon).toBe("failed");
    expect(entry.title).toBe("Transaction failed");
  });

  it("maps every fixture without throwing and with a populated presentation", () => {
    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; a for...of reads clearer here than a .forEach for a loop body with multiple sequential assertions.
    for (const tx of mockScenarioTransactions) {
      const entry = mapV2Transaction(tx, ctx);
      expect(entry.id).toBe(tx.hash);
      expect(entry.primaryText).toBeTruthy();
      expect(entry.details.title).toBeTruthy();
      expect(entry.details.operations.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Amounts arrive as smallest-unit integers with no scale, so the resolved token's
 * decimals are the only thing that makes them meaningful — and a token whose
 * scale we could not resolve must not be rendered as though it were 7.
 */
describe("token scale", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow -- ported verbatim from the extension's test suite; `token` here is the resolved-token override, distinct from the top-level `token(...)` fixture-builder function it shadows.
  const withUsdc = (token: ResolvedToken): MapV2Context => ({
    ...ctx,
    tokens: new Map([...tokens, [MOCK_USDC_SAC, token]]),
  });

  it("scales an amount by the token's own decimals", () => {
    const raw = { ...token("USDC", MOCK_USDC_SAC), decimals: 18 };
    const entry = mapV2Transaction(
      mockTokenTransferSent,
      withUsdc(raw as ResolvedToken),
    );

    // 404000000 at 18 decimals, not the 40.4 that 7 decimals would give
    expect(entry.details.balanceChanges[0].amount).toBe("0.000000000404");
    expect(entry.amounts).toEqual([
      { text: "-0.000000000404 USDC", direction: "debit" },
    ]);
  });

  it("reports no amount when the token's scale is unknown", () => {
    const unscaled = { ...token("USDC", MOCK_USDC_SAC), decimals: null };
    const entry = mapV2Transaction(mockTokenTransferSent, withUsdc(unscaled));

    expect(entry.details.balanceChanges[0].amount).toBeNull();
    // em dash, not a number derived from a guessed scale
    expect(entry.amounts).toEqual([{ text: "— USDC", direction: "debit" }]);
  });

  it("omits the swap rate when one side's scale is unknown", () => {
    const unscaled = { ...token("USDC", MOCK_USDC_SAC), decimals: null };
    const entry = mapV2Transaction(mockSwapClassicDex, withUsdc(unscaled));

    // still recognizably a swap, just without a computable ratio
    expect(entry.kind).toBe("swapped");
    expect(entry.details.rate).toBeNull();
  });
});

/**
 * The mocked app history is a real capture (see history-v2.ts). These guard the
 * wire quirks that only real data exposes — they are the reason the fixture was
 * rebuilt from a live account.
 */
describe("real captured history", () => {
  const realTokens: TokenContext = new Map([
    [REAL_XLM_SAC, token("XLM", REAL_XLM_SAC)],
    [REAL_YUSDC_SAC, token("yUSDC", REAL_YUSDC_SAC)],
    [REAL_BLND_SAC, token("BLND", REAL_BLND_SAC)],
    [REAL_CETES_SAC, token("CETES", REAL_CETES_SAC)],
  ]);
  const realCtx: MapV2Context = {
    tokens: realTokens,
    publicKey: REAL_ACCOUNT,
    nativeTokenId: REAL_XLM_SAC,
  };
  const rows = () =>
    mockHistoryTransactions.map((tx) => mapV2Transaction(tx, realCtx));

  it("keeps the real wire encodings", () => {
    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; nested for...of over transactions/state-changes reads clearer here than a .forEach/.every rewrite.
    for (const tx of mockHistoryTransactions) {
      expect(tx.operations.length).toBeGreaterThan(0);
      expect(tx.result_code.endsWith("Success")).toBe(true);
      expect(tx.hash).toMatch(/^[0-9a-f]{64}$/);
      // eslint-disable-next-line no-restricted-syntax -- ported verbatim; see the outer loop's disable reason above.
      for (const change of tx.state_changes) {
        if ("token_id" in change && change.token_id) {
          expect(change.token_id).toMatch(/^C[A-Z2-7]{55}$/);
        }
      }
    }
  });

  it("maps every real transaction to a populated row", () => {
    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; a for...of reads clearer here than a .forEach for a loop body with multiple sequential assertions.
    for (const tx of mockHistoryTransactions) {
      const entry = mapV2Transaction(tx, realCtx);
      expect(entry.id).toBe(tx.hash);
      expect(entry.primaryText).toBeTruthy();
      expect(entry.details.title).toBeTruthy();
      expect(entry.details.operations.length).toBeGreaterThan(0);
    }
  });

  it("renders the multi-op swap-with-trustline transaction", () => {
    // 2026-07-14: CHANGE_TRUST + PATH_PAYMENT_STRICT_SEND in one transaction
    const tx = mockHistoryTransactions.find(
      (candidate) =>
        candidate.operations.some(
          (op) => op.operation_type === "PATH_PAYMENT_STRICT_SEND",
        ) &&
        candidate.operations.some((op) => op.operation_type === "CHANGE_TRUST"),
    )!;
    const entry = mapV2Transaction(tx, realCtx);

    expect(entry.kind).toBe("swapped");
    expect(entry.details.stateChangeCards).toEqual([
      expect.objectContaining({ kind: "trustlines", verb: "created" }),
    ]);
    // the XLM debit and the fee are both XLM; only the debit is a balance row
    expect(entry.details.balanceChanges).toHaveLength(2);
    expect(entry.details.fee).toBe("0.00002");
  });

  it("labels the Blend claims with the protocol action", () => {
    const claims = rows().filter((entry) =>
      entry.amounts !== "multiple"
        ? (entry.amounts ?? []).some((a) => a.text.endsWith("BLND")) &&
          entry.details.functionName !== null
        : false,
    );

    expect(claims).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; a for...of reads clearer here than a .forEach for a loop body with multiple sequential assertions.
    for (const claim of claims) {
      // the overlay replaces only the labels: kind and amounts are untouched
      expect(claim.kind).toBe("received");
      expect(claim.primaryText).toBe("Claimed emissions");
      expect(claim.secondaryText).toBe("Blend");
      expect(claim.secondaryIcon).toBe("contract");
      expect(claim.details.title).toBe("Claimed emissions");
    }
  });

  it("leaves rows without a protocol state change untouched", () => {
    // A plain inbound payment has no BLEND_* row, so it keeps the asset-code
    // primary and the direction verb — this is the "preserve everything else"
    // guarantee, asserted directly rather than only via the other suites. The
    // feature's central promise is that the overlay touches only the label
    // fields, so kind/rowIcon/amounts must come through untouched too.
    const payment = mockHistoryTransactions.find(
      (tx) =>
        tx.operations.length > 0 &&
        tx.operations.every((op) => op.operation_type === "PAYMENT") &&
        !tx.state_changes.some((change) => change.type.startsWith("BLEND_")),
    )!;
    const entry = mapV2Transaction(payment, realCtx);

    expect(entry.primaryText).not.toBe("Claimed emissions");
    expect(entry.secondaryText).toBe("Received");
    expect(entry.kind).toBe("received");
    expect(entry.rowIcon).toEqual({
      type: "asset",
      tokens: [realTokens.get(REAL_YUSDC_SAC)],
    });
    expect(entry.amounts).toEqual([
      { text: "+0.0000086 yUSDC", direction: "credit" },
    ]);
  });

  /**
   * A Blend claim carries a `BlendEmissionsClaimChange` alongside the generic
   * BalanceChange for the same movement — the two are additive, not a
   * replacement. The UI reads the Blend row for the protocol-action label, but it
   * must never double-count into a second amount row or a state-change card.
   */
  it("does not double-count the Blend row against the balance change", () => {
    const claims = mockHistoryTransactions.filter((tx) =>
      tx.state_changes.some(
        (change) => change.variant === "BlendEmissionsClaimChange",
      ),
    );
    expect(claims).toHaveLength(3);

    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; a for...of reads clearer here than a .forEach for a loop body with multiple sequential assertions.
    for (const tx of claims) {
      const blend = tx.state_changes.find(
        (change) => change.variant === "BlendEmissionsClaimChange",
      )!;
      if (blend.variant !== "BlendEmissionsClaimChange") {
        throw new Error("unreachable");
      }
      // the Blend row restates the CREDIT's token and amount verbatim
      const credit = tx.state_changes.find(
        (change) =>
          change.variant === "BalanceChange" && change.reason === "CREDIT",
      )!;
      expect(blend.amount).toBe(
        credit.variant === "BalanceChange" ? credit.amount : null,
      );
      expect(blend.token_id).toBe(REAL_BLND_SAC);
      expect(blend.pool_id).toMatch(/^C[A-Z2-7]{55}$/);

      const entry = mapV2Transaction(tx, realCtx);
      // one BLND row, not two, and the Blend row produces no card
      expect(entry.details.balanceChanges).toHaveLength(1);
      expect(entry.amounts).toEqual([
        expect.objectContaining({ direction: "credit" }),
      ]);
      expect(entry.details.stateChangeCards).toEqual([]);
    }
  });

  it("names claimable-balance airdrops after the operation", () => {
    // This account is only a claimant, so upstream reports no state change at
    // all until the balance is claimed — the operation type is all the row has
    // to go on.
    const airdrops = mockHistoryTransactions.filter((tx) =>
      tx.operations.some(
        (op) => op.operation_type === "CREATE_CLAIMABLE_BALANCE",
      ),
    );

    expect(airdrops.length).toBeGreaterThan(0);
    const claimantOnly = airdrops.filter((tx) => tx.state_changes.length === 0);
    expect(claimantOnly).toHaveLength(2);
    // eslint-disable-next-line no-restricted-syntax -- ported verbatim from the extension's test suite; a for...of reads clearer here than a .forEach for a loop body with multiple sequential assertions.
    for (const tx of claimantOnly) {
      const entry = mapV2Transaction(tx, realCtx);
      expect(entry.kind).toBe("other");
      expect(entry.primaryText).toBe("Claimable balance created");
      expect(entry.secondaryText).toBe("Pending claim");
      expect(entry.rowIcon).toEqual({ type: "settings", glyph: "claimable" });
      expect(entry.details.title).toBe("Claimable balance created");
      expect(entry.amounts).toBeNull();
    }
  });

  it("carries dust in both native and non-native flavors", () => {
    const dust = rows().filter(
      (entry) =>
        entry.amounts !== "multiple" &&
        (entry.amounts ?? []).some(
          (a) => a.text.startsWith("+0.000") && a.direction === "credit",
        ),
    );

    // 12 recurring yUSDC payouts + 6 one-stroop XLM credits. Only the XLM ones
    // are hidden by the dust filter, which is native-only (see helpers/history/filters).
    // A seventh one-stroop credit exists in the capture, but its transaction
    // pairs the PAYMENT with a CREATE_CLAIMABLE_BALANCE — two distinct
    // operation families — so op-driven identity honestly labels it
    // "Transaction" with the Multiple amounts treatment instead of an XLM row.
    expect(dust.filter((e) => e.primaryText === "yUSDC")).toHaveLength(12);
    expect(dust.filter((e) => e.primaryText === "XLM")).toHaveLength(6);
  });
});

/**
 * Not from the extension — repo-specific regression coverage added for
 * Fix round 2 of Task 5's review. `signedAmount` (classify.ts) is not
 * exported and takes no `locale` parameter; it always reads the device
 * locale via formatAmount's internal `getDeviceLanguage()` default. To
 * reach it under a non-"en" device locale without adding a locale
 * parameter to production code (explicitly out of scope for this fix), this
 * overrides the mocked `getDeviceLanguage` for a single assertion via
 * `mockReturnValueOnce` and drives the real production path
 * (buildPresentation -> basePresentation -> signedAmount -> formatAmount)
 * end to end.
 */
describe("locale-aware amount formatting end-to-end (repo-specific regression, not from the extension)", () => {
  it("renders a round balance correctly under a comma-decimal device locale", () => {
    (getDeviceLanguage as jest.Mock).mockReturnValueOnce("pt");

    const row: BalanceChangeRow = {
      token: token("XLM", MOCK_XLM_SAC),
      amount: "1230",
      direction: "credit",
    };

    const entry = buildPresentation({
      classification: { type: "received", row },
      cards: [],
      protocol: null,
      failed: false,
      operationTypes: [],
      protocolAction: null,
    });

    // Correct: "1.230" (pt-style thousands grouping), not "1.23" (the
    // magnitude-corrupting result the reversed helper-call order would
    // produce — see __tests__/helpers/formatAmount.test.ts's "regression:
    // order matters on a reachable input shape" for the isolated proof).
    expect(entry.amounts).toEqual([
      { text: "+1.230 XLM", direction: "credit" },
    ]);
  });
});
