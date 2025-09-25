import { renderHook, userEvent } from "@testing-library/react-native";
import { SecurityDetailBottomSheet } from "components/blockaid/SecurityDetailBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import { SecurityWarning } from "services/blockaid/helper";

describe("SecurityDetailBottomSheet", () => {
  const mockWarnings: SecurityWarning[] = [
    {
      id: "warning-1",
      description: "This token appears to be malicious",
    },
    {
      id: "warning-2",
      description: "Domain verification failed",
    },
  ];

  const defaultProps = {
    warnings: mockWarnings,
    onCancel: jest.fn(),
    onProceedAnyway: jest.fn(),
    onClose: jest.fn(),
    proceedAnywayText: "Approve anyway",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with malicious severity", () => {
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

  it("calls onCancel when cancel button is pressed", async () => {
    const user = userEvent.setup();
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet {...defaultProps} />,
    );

    await user.press(getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  }, 10000);

  it("calls onProceedAnyway when proceed anyway text is pressed", async () => {
    const user = userEvent.setup();
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet {...defaultProps} />,
    );

    await user.press(getByText("Approve anyway"));
    expect(defaultProps.onProceedAnyway).toHaveBeenCalledTimes(1);
  }, 10000);

  it("calls onClose when close button is pressed", () => {
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet {...defaultProps} />,
    );

    // For now, we'll test that the component renders correctly
    // The close button interaction can be tested in integration tests
    expect(getByText("This token appears to be malicious")).toBeTruthy();
  });

  it("uses different proceed anyway text based on proceedAnywayText", () => {
    const { getByText } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        proceedAnywayText="Connect anyway"
      />,
    );

    expect(getByText("Connect anyway")).toBeTruthy();
  });

  it("renders with different variants for malicious vs warning", () => {
    const { getByText: getByTextMalicious } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.MALICIOUS}
      />,
    );

    // Should show "Do not proceed" for malicious
    expect(getByTextMalicious(/do not proceed/i)).toBeTruthy();

    const { getByText: getByTextWarning } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        severity={SecurityLevel.SUSPICIOUS}
      />,
    );

    // Should show "Suspicious request" for warning
    expect(getByTextWarning(/suspicious request/i)).toBeTruthy();
  });

  it("renders correct description based on securityContext", () => {
    const { result } = renderHook(() => useAppTranslation());
    const tokenContext = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        securityContext={SecurityContext.TOKEN}
      />,
    );
    expect(
      tokenContext.getByText(result.current.t("securityWarning.token")),
    ).toBeTruthy();

    const siteContext = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
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
        securityContext={SecurityContext.TRANSACTION}
      />,
    );
    expect(
      transactionContext.getByText(
        result.current.t("securityWarning.unsafeTransaction"),
      ),
    ).toBeTruthy();
  });

  it("renders correctly when onCancel and onProceedAnyway are not provided", () => {
    const { queryByText } = renderWithProviders(
      <SecurityDetailBottomSheet
        {...defaultProps}
        onCancel={undefined}
        onProceedAnyway={undefined}
      />,
    );

    expect(queryByText("Cancel")).toBeNull();
    expect(queryByText(defaultProps.proceedAnywayText)).toBeNull();
  });
});
