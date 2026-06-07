import { renderHook, userEvent } from "@testing-library/react-native";
import {
  SecurityDetailBottomSheet,
  SecurityDetailFooter,
} from "components/blockaid/SecurityDetailBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import { SecurityWarning } from "services/blockaid/helper";

describe("SecurityDetailBottomSheet (body)", () => {
  const mockWarnings: SecurityWarning[] = [
    {
      id: "warning-1",
      description: "This token appears to be malicious",
      severity: "malicious",
    },
    {
      id: "warning-2",
      description: "Domain verification failed",
      severity: "warning",
    },
  ];

  const defaultProps = {
    warnings: mockWarnings,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both warnings regardless of severity", () => {
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
      />,
    );

    expect(getByText("This token appears to be malicious")).toBeTruthy();
    expect(getByText("Domain verification failed")).toBeTruthy();
  });

  it("renders correctly with suspicious severity", () => {
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.SUSPICIOUS}
      />,
    );

    expect(getByText("This token appears to be malicious")).toBeTruthy();
    expect(getByText("Domain verification failed")).toBeTruthy();
  });

  it("renders with different titles for malicious vs warning vs expected to fail", () => {
    const { getByText: getByTextMalicious } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
      />,
    );

    expect(getByTextMalicious(/do not proceed/i)).toBeTruthy();

    const { getByText: getByTextWarning } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.SUSPICIOUS}
      />,
    );

    expect(getByTextWarning(/suspicious request/i)).toBeTruthy();

    const { getByText: getByTextExpectedToFail } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.EXPECTED_TO_FAIL}
      />,
    );

    expect(getByTextExpectedToFail(/warning/i)).toBeTruthy();
    expect(
      getByTextExpectedToFail(
        /this transaction is expected to fail for the following reasons:/i,
      ),
    ).toBeTruthy();
  });

  it("renders correct description based on securityContext", () => {
    const { result } = renderHook(() => useAppTranslation());
    const tokenContext = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
        securityContext={SecurityContext.TOKEN}
      />,
    );
    expect(
      tokenContext.getByText(result.current.t("securityWarning.token")),
    ).toBeTruthy();

    const siteContext = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
        securityContext={SecurityContext.SITE}
      />,
    );
    expect(
      siteContext.getByText(
        result.current.t("securityWarning.unsafeTransaction"),
      ),
    ).toBeTruthy();

    const transactionContext = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
        securityContext={SecurityContext.TRANSACTION}
      />,
    );
    expect(
      transactionContext.getByText(
        result.current.t("securityWarning.unsafeTransaction"),
      ),
    ).toBeTruthy();
  });
});

describe("SecurityDetailFooter", () => {
  const defaultProps = {
    onCancel: jest.fn(),
    onProceedAnyway: jest.fn(),
    proceedAnywayText: "Approve anyway",
    severity: SecurityLevel.MALICIOUS as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls onCancel when cancel button is pressed", async () => {
    const user = userEvent.setup();
    const { getByText } = renderWithProviders(
      <SecurityDetailFooter {...defaultProps} />,
    );

    await user.press(getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onProceedAnyway when proceed-anyway text is pressed", async () => {
    const user = userEvent.setup();
    const { getByText } = renderWithProviders(
      <SecurityDetailFooter {...defaultProps} />,
    );

    await user.press(getByText("Approve anyway"));
    expect(defaultProps.onProceedAnyway).toHaveBeenCalledTimes(1);
  });

  it("uses the provided proceedAnywayText", () => {
    const { getByText } = renderWithProviders(
      <SecurityDetailFooter
        {...defaultProps}
        proceedAnywayText="Connect anyway"
      />,
    );

    expect(getByText("Connect anyway")).toBeTruthy();
  });

  it("renders no buttons when neither handler is provided", () => {
    const { queryByText } = renderWithProviders(
      <SecurityDetailFooter
        {...defaultProps}
        onCancel={undefined}
        onProceedAnyway={undefined}
      />,
    );

    expect(queryByText("Cancel")).toBeNull();
    expect(queryByText("Approve anyway")).toBeNull();
  });
});
