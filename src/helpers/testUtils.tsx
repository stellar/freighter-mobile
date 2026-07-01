/* eslint-disable import/no-extraneous-dependencies */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { RenderAPI, render } from "@testing-library/react-native";
import i18n from "i18n";
import { ToastProvider } from "providers/ToastProvider";
import React from "react";
import { I18nextProvider } from "react-i18next";

/**
 * Type definition for the renderWithProviders function
 * Matches the return type of the testing-library render function
 *
 * @internal
 */
type RenderWithProviderType = (component: React.ReactElement) => RenderAPI;

// Mock the OS language detection for consistent test behavior
jest.mock("helpers/localeUtils");

/**
 * Renders a React component with all necessary providers for testing
 *
 * This utility wraps a component with the I18nextProvider to enable
 * translation functionality in tests. It's designed to be extended
 * with additional providers as the application grows.
 *
 * @param {React.ReactElement} component - The React component to render
 * @returns {RenderAPI} The render API from @testing-library/react-native
 *
 * @example
 * // Basic component test with providers
 * const { getByText } = renderWithProviders(<MyComponent />);
 * expect(getByText('Hello')).toBeTruthy();
 */
const AllProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <I18nextProvider i18n={i18n}>
    <BottomSheetModalProvider>
      <ToastProvider>{children}</ToastProvider>
    </BottomSheetModalProvider>
  </I18nextProvider>
);

export const renderWithProviders: RenderWithProviderType = (component) => {
  try {
    // Use the `wrapper` option (rather than wrapping inline) so the returned
    // `rerender` keeps the providers in place across re-renders.
    return render(component, { wrapper: AllProviders });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error rendering component:", error);
    throw error;
  }
};
