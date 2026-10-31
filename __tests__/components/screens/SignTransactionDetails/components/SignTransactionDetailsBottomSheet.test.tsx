import { OperationRecord } from "@stellar/stellar-sdk";
import { SignTransactionDetailsSheet } from "components/screens/SignTransactionDetails";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import {
  AuthEntryDisplay,
  SignTransactionDetailsInterface,
} from "components/screens/SignTransactionDetails/types";
import { logger } from "config/logger";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/** The section that throws while rendering, or null when none does. */
let mockThrowingSection: "summary" | "authorizations" | "operations" | null =
  null;

jest.mock(
  "components/screens/SignTransactionDetails/components/SignTransactionSummary",
  () => {
    const { Text: MockText } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: () => {
        if (mockThrowingSection === "summary") {
          throw new Error("summary render failed");
        }
        return <MockText>summary</MockText>;
      },
    };
  },
);

jest.mock(
  "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations",
  () => {
    const { Text: MockText } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: () => {
        if (mockThrowingSection === "authorizations") {
          throw new Error("authorizations render failed");
        }
        return <MockText>authorizations</MockText>;
      },
    };
  },
);

jest.mock(
  "components/screens/SignTransactionDetails/components/SignTransactionOperationDetails",
  () => {
    const { Text: MockText } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: () => {
        if (mockThrowingSection === "operations") {
          throw new Error("operations render failed");
        }
        return <MockText>operations</MockText>;
      },
    };
  },
);

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

// Renders the sheet's content as if it were presented. Only
// SignTransactionDetailsSheet, which hosts this sheet's body, uses it.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({ customContent }: { customContent: React.ReactNode }) =>
    customContent,
}));

/** Details for `xdr`. The sections are stand-ins, so entries only need to exist. */
const details = (
  xdr: string,
  { withSections = false } = {},
): SignTransactionDetailsInterface => ({
  summary: {
    operationsCount: 1,
    feeXlm: "0.00001",
    sequenceNumber: "1",
    memo: null,
    xdr,
  },
  authEntries: withSections ? [{} as AuthEntryDisplay] : [],
  operations: withSections ? [{} as OperationRecord] : [],
  hasTrustlineChanges: false,
});

describe("SignTransactionDetailsBottomSheet", () => {
  const onRenderError = jest.fn();

  beforeEach(() => {
    // React logs every error a boundary catches; the report is asserted on
    // instead, so the log would only be noise.
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    mockThrowingSection = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders every section when nothing throws", () => {
    const { getByText, queryByTestId } = renderWithProviders(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-1", { withSections: true })}
        onRenderError={onRenderError}
      />,
    );

    expect(getByText("summary")).toBeTruthy();
    expect(getByText("authorizations")).toBeTruthy();
    expect(getByText("operations")).toBeTruthy();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
    expect(onRenderError).not.toHaveBeenCalled();
  });

  it("shows the unreadable notice, reports to Sentry and calls onRenderError when the details throw", () => {
    mockThrowingSection = "summary";

    const { getByTestId, getByText } = renderWithProviders(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-1")}
        onRenderError={onRenderError}
      />,
    );

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(getByText("signTransactionDetails.unreadable.title")).toBeTruthy();
    expect(
      getByText("signTransactionDetails.unreadable.description"),
    ).toBeTruthy();
    expect(onRenderError).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "SignTransactionDetails",
      "Render error caught by error boundary",
      expect.objectContaining({ message: "summary render failed" }),
      expect.anything(),
    );
  });

  it.each(["authorizations", "operations"] as const)(
    "replaces all three sections when the %s throw",
    (section) => {
      mockThrowingSection = section;

      const { getByTestId, queryByText } = renderWithProviders(
        <SignTransactionDetailsBottomSheet
          data={details("xdr-1", { withSections: true })}
          onRenderError={onRenderError}
        />,
      );

      expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
      expect(queryByText("summary")).toBeNull();
      expect(onRenderError).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "SignTransactionDetails",
        "Render error caught by error boundary",
        expect.objectContaining({ message: `${section} render failed` }),
        expect.anything(),
      );
    },
  );

  it("only shows the notice when there is no onRenderError, as on send and swap", () => {
    mockThrowingSection = "summary";

    const { getByTestId } = renderWithProviders(
      <SignTransactionDetailsBottomSheet data={details("xdr-1")} />,
    );

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("keeps the notice when the same transaction renders again", () => {
    mockThrowingSection = "summary";
    const { getByTestId, rerender } = renderWithProviders(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-1")}
        onRenderError={onRenderError}
      />,
    );
    mockThrowingSection = null;

    // New details object, same transaction.
    rerender(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-1")}
        onRenderError={onRenderError}
      />,
    );

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(onRenderError).toHaveBeenCalledTimes(1);
  });

  it("renders the details again for a new transaction", () => {
    mockThrowingSection = "summary";
    const { getByText, queryByTestId, rerender } = renderWithProviders(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-1")}
        onRenderError={onRenderError}
      />,
    );
    mockThrowingSection = null;

    rerender(
      <SignTransactionDetailsBottomSheet
        data={details("xdr-2")}
        onRenderError={onRenderError}
      />,
    );

    expect(getByText("summary")).toBeTruthy();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    // A reset isn't reported to the parent.
    expect(onRenderError).toHaveBeenCalledTimes(1);
  });
});

describe("SignTransactionDetailsSheet, which hosts the sheet", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    mockThrowingSection = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes onRenderError through to the sheet's boundary", () => {
    mockThrowingSection = "summary";
    const onRenderError = jest.fn();

    const { getByTestId } = renderWithProviders(
      <SignTransactionDetailsSheet
        modalRef={React.createRef()}
        data={details("xdr-1")}
        onRenderError={onRenderError}
      />,
    );

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(onRenderError).toHaveBeenCalledTimes(1);
  });
});
