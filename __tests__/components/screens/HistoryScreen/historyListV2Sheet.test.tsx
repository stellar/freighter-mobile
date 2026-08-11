// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in TransactionDetailsV2/index.test.tsx.
import { Asset, Operation } from "@stellar/stellar-sdk";
import { fireEvent } from "@testing-library/react-native";
import HistoryScreen from "components/screens/HistoryScreen/HistoryScreen";
import {
  HistoryItemData,
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from "components/screens/HistoryScreen/types";
import { HistoryEntry, HistoryOperation } from "helpers/history/v2/model";
import { renderWithProviders } from "helpers/testUtils";
import "i18n";
import React from "react";

// Harness mocks copied verbatim from HistoryScreen.test.tsx — this screen
// needs the store, navigation and locale mocks that suite already
// establishes. Deliberately NOT copied: that suite's mock of HistoryItem
// (renders null), since these tests press real rows to reach real v1/v2
// sheet content.
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn((callback) => {
    callback();
    return () => {};
  }),
}));

jest.mock("helpers/localeUtils", () => ({
  getDeviceLanguage: jest.fn().mockReturnValue("en"),
  isSupportedLanguage: jest.fn().mockReturnValue(true),
}));

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    account: {
      publicKey: "GDSJDSJDKLSJDKLJSD",
    },
  })),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    network: "PUBLIC",
    setSignInMethod: jest.fn(),
  })),
  getLoginType: jest.fn((biometryType) => {
    if (!biometryType) return "password";
    if (biometryType === "FaceID" || biometryType === "Face") return "face";
    if (biometryType === "TouchID" || biometryType === "Fingerprint")
      return "fingerprint";
    return "password";
  }),
}));

// The v2 footer test presses TransactionDetailsFooter's button, which calls
// useInAppBrowser().open(externalUrl) — mocked the same way
// XlmReserveBottomSheet.test.tsx mocks it, so the assertion can check
// exactly which URL the footer built rather than exercising a real browser.
const mockOpenInAppBrowser = jest.fn();
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: mockOpenInAppBrowser,
  }),
}));

// Not part of HistoryScreen.test.tsx's harness (that suite mocks HistoryItem
// itself, so handleTransactionDetails/handleV2TransactionDetails — and the
// analytics.trackHistoryOpenItem call inside them — never run). These tests
// press real rows, so they reach that call for real; mocked the same way
// other suites mock this module (see e.g. useManageToken.test.tsx) rather
// than exercising the real analytics client in a component test.
jest.mock("services/analytics", () => ({
  analytics: {
    trackHistoryOpenItem: jest.fn(),
    // TransactionDetailsFooter's button press also calls analytics.track
    // (a HISTORY_OPEN_ITEM event) — needed now that the footer test below
    // presses through to it on the v2 path too.
    track: jest.fn(),
  },
}));

// jest.setup.js already mocks @gorhom/bottom-sheet's useBottomSheetModal /
// useBottomSheet hooks globally, but spreads jest.requireActual for
// everything else — so the real BottomSheetModal *component* (what
// components/BottomSheet.tsx renders directly via a ref, not via the hook)
// is what every other suite gets. That real component crashes under this
// Jest environment the moment .present() actually runs (confirmed by a
// standalone repro: `TypeError: Cannot read properties of undefined
// (reading 'UNDETERMINED')` inside @gorhom/bottom-sheet's own BottomSheet.tsx,
// from a State.UNDETERMINED shared value it initializes off
// react-native-gesture-handler's real State enum — not something these
// tests, or Task 8, can fix). No existing suite in this repo calls .present()
// on a real BottomSheetModal ref and asserts on the result; every other
// place that renders v1/v2 sheet content (advancedDetails.test.tsx,
// TransactionDetailsV2/index.test.tsx, XlmReserveBottomSheet.test.tsx) does
// so by rendering the content component directly, with no BottomSheetModal
// in the tree at all. HistoryList owns the one BottomSheet these tests need
// to press through, so it can't dodge the modal that way — instead, this
// mock (scoped to this file only) replaces just the modal shell with one
// that mounts its children only once `present()` is called, the same
// present-gated contract the real component has, without its
// gesture-handler-dependent internals. This is the same kind of
// BottomSheetModal replacement TransactionSettingsBottomSheet.test.tsx uses
// (there, an unconditional passthrough); the gate here is added so the
// "sheet content is not mounted before the press" assertions stay
// meaningful rather than vacuous.
jest.mock("@gorhom/bottom-sheet", () => {
  // require() (not a top-level import) is required here: jest.mock's factory
  // is hoisted above imports and cannot reference out-of-scope variables, so
  // the module needs to be pulled in from inside the factory itself.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const ReactActual = require("react");
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const RN = require("react-native");

  const BottomSheetModal = ReactActual.forwardRef(
    (
      { children }: { children?: React.ReactNode },
      ref: React.Ref<{
        present: () => void;
        dismiss: () => void;
        close: () => void;
        snapToIndex: () => void;
        expand: () => void;
        collapse: () => void;
      }>,
    ) => {
      const [isPresented, setIsPresented] = ReactActual.useState(false);
      ReactActual.useImperativeHandle(ref, () => ({
        present: () => setIsPresented(true),
        dismiss: () => setIsPresented(false),
        close: () => setIsPresented(false),
        snapToIndex: () => {},
        expand: () => {},
        collapse: () => {},
      }));
      return isPresented ? children : null;
    },
  );

  return {
    __esModule: true,
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    BottomSheetModal,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => children,
    BottomSheetScrollView: RN.ScrollView,
    BottomSheetBackdrop: () => null,
    BottomSheetTextInput: RN.TextInput,
  };
});

// useGetHistoryData is mocked directly (as HistoryScreen.test.tsx does) so
// each helper below can seed whichever section shape it needs without going
// through the real store/remote-config flag.
const mockUseGetHistoryData = jest.fn();
jest.mock("hooks/useGetHistoryData", () => ({
  useGetHistoryData: () => mockUseGetHistoryData(),
}));

// HistoryItem's own mapHistoryItemData effect (the v1 path) reads a Horizon
// operation and produces its HistoryItemData through several per-type
// mappers — real, but not what these tests are about. Mocked the same way a
// v1 row's *content* is out of scope here; only that pressing it opens the
// v1 sheet (not the v2 one) matters. The v2 path is never mocked: v2 rows
// carry their HistoryItemData pre-built (mapV2EntryToHistoryItemData, a
// different module from this barrel), and TransactionDetailsV2 renders for
// real with no mocks beyond the harness above.
const mockMapHistoryItemData = jest.fn();
jest.mock("components/screens/HistoryScreen/mappers", () => ({
  mapHistoryItemData: (...args: unknown[]) => mockMapHistoryItemData(...args),
}));

const V2_TITLE = "Sent XLM";

// Same v2 fixture shape used by TransactionDetailsV2/index.test.tsx and
// advancedDetails.test.tsx — kept identical so this integration exercises the
// same known-safe combination of null/empty fields those suites already
// proved renders without crashing.
const buildV2Entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({
    id: "v2-tx-1",
    kind: "sent",
    createdAt: "2024-04-08T14:33:00Z",
    rowIcon: { type: "contract" },
    primaryText: "XLM",
    secondaryText: "Sent",
    secondaryIcon: "sent",
    amounts: null,
    details: {
      title: V2_TITLE,
      status: "success",
      fee: "0.00001",
      rate: null,
      contractId: null,
      functionName: null,
      protocol: null,
      counterparty: null,
      balanceChanges: [],
      stateChangeCards: [],
      operations: [],
    },
    ...overrides,
  }) as HistoryEntry;

const v1TransactionDetails: TransactionDetails = {
  operation: {
    created_at: "2024-01-01T00:00:00Z",
  } as unknown as TransactionDetails["operation"],
  transactionTitle: "V1 Title",
  transactionType: TransactionType.UNKNOWN,
  externalUrl: "https://stellar.expert/explorer/testnet/tx/abc",
  fee: "100",
  xdr: "AAAAAA==",
  status: TransactionStatus.SUCCESS,
  IconComponent: null,
  ActionIconComponent: null,
};

const v1HistoryItemData: HistoryItemData = {
  transactionDetails: v1TransactionDetails,
  rowText: "v1-row-label",
  actionText: "Sent",
  ActionIconComponent: null,
  dateText: "Jan 1",
  amountText: "-1 XLM",
  IconComponent: null,
  transactionStatus: TransactionStatus.SUCCESS,
  isAddingFunds: false,
};

const renderHistoryWithV2Entries = (
  entries: HistoryEntry[] = [buildV2Entry()],
) => {
  mockUseGetHistoryData.mockReturnValue({
    historyData: {
      balances: {},
      history: [{ monthYear: "4:2024", entries }],
    },
    fetchData: jest.fn(),
    isLoading: false,
    error: null,
    isRefreshing: false,
    isNavigationRefresh: false,
  });

  return renderWithProviders(
    <HistoryScreen navigation={{} as never} route={{} as never} />,
  );
};

const renderHistoryWithV1Operations = () => {
  mockMapHistoryItemData.mockResolvedValue(v1HistoryItemData);
  mockUseGetHistoryData.mockReturnValue({
    historyData: {
      balances: {},
      history: [
        {
          monthYear: "1:2024",
          operations: [
            { id: "op-1", type: "payment", created_at: "2024-01-01T00:00:00Z" },
          ],
        },
      ],
    },
    fetchData: jest.fn(),
    isLoading: false,
    error: null,
    isRefreshing: false,
    isNavigationRefresh: false,
  });

  return renderWithProviders(
    <HistoryScreen navigation={{} as never} route={{} as never} />,
  );
};

describe("HistoryList — v2 detail sheet", () => {
  beforeEach(() => {
    mockUseGetHistoryData.mockReset();
    mockMapHistoryItemData.mockReset();
    mockOpenInAppBrowser.mockReset();
  });

  it("opens the v2 sheet when a v2 row is pressed", async () => {
    const { findByText, queryByText } = renderHistoryWithV2Entries();

    // Before the press the sheet content is not mounted.
    expect(queryByText(V2_TITLE)).toBeNull();

    fireEvent.press(await findByText("XLM"));

    // details.title comes from the v2 model, so its presence proves the v2
    // content rendered rather than the v1 content. findByText (not
    // getByText) defensively: the mocked BottomSheetModal above only mounts
    // its children after present() flips its internal state, one render
    // pass after the press.
    expect(await findByText(V2_TITLE)).toBeTruthy();
  });

  it("renders the footer for a v2 row, built from the real HistoryEntry hash (not the absent v1 externalUrl)", async () => {
    // HistoryEntry.id IS the transaction hash (model.ts), and
    // getStellarExpertUrl(network) already exists — the same construction
    // TransactionDetailsBottomSheet.tsx uses for its own explorer link. The
    // footer must render on the v2 path too, using that, not stay disabled
    // on the (false) premise that v2 has nothing to build a footer from.
    const { findByText } = renderHistoryWithV2Entries([
      buildV2Entry({ id: "abc123hash" }),
    ]);

    fireEvent.press(await findByText("XLM"));

    fireEvent.press(await findByText("View on stellar.expert"));
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      "https://stellar.expert/explorer/public/tx/abc123hash",
    );
  });

  it("reaches the advanced view from an opened v2 sheet", async () => {
    const { findByText, findByTestId, getByTestId } =
      renderHistoryWithV2Entries();

    fireEvent.press(await findByText("XLM"));
    fireEvent.press(await findByTestId("advanced-details-link"));

    expect(getByTestId("advanced-details")).toBeTruthy();
  });

  it("resets to the detail view when a different v2 row is opened while a sub-view is showing", async () => {
    // Two distinct entries so each row and each sheet render is
    // unambiguous. Without a remount keyed on the entry's id, opening
    // entryA, navigating into its advanced sub-view, then opening entryB
    // would leave the sheet's internal `view` state stuck on "advanced" —
    // now showing entryB's data under a view state that belongs to entryA.
    // This is only NOT a live bug today because @gorhom/bottom-sheet
    // happens to unmount its children on dismiss; pressing a second row
    // without dismissing first (both rows are in the same underlying list,
    // still mounted behind the open sheet) bypasses that and exercises the
    // state machine's own reset directly.
    const entryA = buildV2Entry({
      id: "v2-tx-a",
      primaryText: "Entry A",
      details: { ...buildV2Entry().details, title: "Detail A" },
    });
    const entryB = buildV2Entry({
      id: "v2-tx-b",
      primaryText: "Entry B",
      details: { ...buildV2Entry().details, title: "Detail B" },
    });

    const { findByText, findByTestId, queryByTestId } =
      renderHistoryWithV2Entries([entryA, entryB]);

    fireEvent.press(await findByText("Entry A"));
    expect(await findByText("Detail A")).toBeTruthy();

    fireEvent.press(await findByTestId("advanced-details-link"));
    expect(await findByTestId("advanced-details")).toBeTruthy();

    fireEvent.press(await findByText("Entry B"));

    // The detail view is showing for entryB — not stuck on entryA's
    // advanced sub-view.
    expect(await findByText("Detail B")).toBeTruthy();
    expect(queryByTestId("advanced-details")).toBeNull();
  });

  it("still opens the v1 content when the flag is off", async () => {
    const { findByText, queryByTestId } = renderHistoryWithV1Operations();

    // v1's own mapHistoryItemData effect is async (see the mock above), so
    // the row's text only appears once it resolves.
    fireEvent.press(await findByText("v1-row-label"));

    // Positive assertion that the v1 sheet's own content actually rendered
    // (transactionTitle, from v1TransactionDetails above) — the negative
    // assertion below alone would also pass if the v1 sheet opened empty, or
    // if nothing opened at all, since neither of those would produce a v2
    // testID either.
    expect(await findByText("V1 Title")).toBeTruthy();

    // v1 content has no v2 testIDs.
    expect(queryByTestId("advanced-details-link")).toBeNull();
  });

  // A fourth case — pressing a v2 row then a v1 row within a *single*
  // render, to prove the two payloads can never both be set — was in the
  // brief's plan but can't be constructed: HistoryList's `sections` memo
  // (see isV2Section/isV2Row in HistoryList.tsx) inspects only the first
  // section of `historyData.history` and casts the *entire* array to that
  // one shape. A `historyData` object mixing a v1 section and a v2 section
  // isn't just untested, it's a shape the real component never receives
  // (the remote-config flag is global, per HistoryScreen.tsx) and would
  // throw if forced (the wrong-shaped section's `.operations`/`.entries`
  // access would be undefined). Dropped per the brief's own escape valve
  // rather than forcing a render tree production code can't produce.
  //
  // The invariant itself is still verifiable by inspection: `v2Entry` and
  // `transactionDetails` in HistoryList.tsx are written only by
  // handleTransactionDetails and handleV2TransactionDetails, and each of
  // those two setters clears the other's state in the same call before
  // presenting the sheet — see HistoryList.tsx.

  it("copies an XDR row to the clipboard and shows a real toast, reached through a real v1→v2 sheet press with no useClipboard mock", async () => {
    // Unlike advancedDetails.test.tsx and TransactionDetailsV2/index.test.tsx,
    // useClipboard is NOT mocked here — this is the carried Task 7 coverage
    // item: no existing automated test mounted AdvancedDetails under a real
    // ToastProvider. renderWithProviders (used by every helper above) wraps
    // in a real ToastProvider, and useClipboard's copyToClipboard calls the
    // real (globally jest-mocked-at-the-native-module-level, see
    // jest.setup.js) @react-native-clipboard/clipboard, then a real
    // useToast().showToast.
    const paymentXdr = Operation.payment({
      destination: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      asset: Asset.native(),
      amount: "1",
    })
      .toXDR()
      .toString("base64");

    const entryWithOperation = buildV2Entry({
      details: {
        ...buildV2Entry().details,
        operations: [
          {
            id: "op-1",
            type: "PAYMENT" as HistoryOperation["type"],
            xdr: paymentXdr,
            successful: true,
          },
        ],
      },
    });

    const { findByText, findByTestId } = renderHistoryWithV2Entries([
      entryWithOperation,
    ]);

    fireEvent.press(await findByText("XLM"));
    fireEvent.press(await findByTestId("advanced-details-link"));
    fireEvent.press(await findByTestId("xdr-row-op-1"));

    // "Copied to clipboard!" is the literal English copy for the
    // common.copied key that copyToClipboard's default notificationMessage
    // resolves to — asserted verbatim (not a substring) per this plan's
    // no-substring-trap rule.
    expect(await findByText("Copied to clipboard!")).toBeTruthy();
  });
});
