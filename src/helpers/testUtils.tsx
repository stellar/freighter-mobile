/* eslint-disable import/no-extraneous-dependencies */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { RenderAPI, render } from "@testing-library/react-native";
import i18n from "i18n";
import { ToastProvider } from "providers/ToastProvider";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { ReactTestInstance } from "react-test-renderer";

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

/** A single node of the render tree `toJSON()` returns. */
export interface RenderedNode {
  type: string;
  props: Record<string, unknown>;
  children: (RenderedNode | string)[] | null;
}

/** Anything `toJSON()` can hand back, or any child of it. */
export type RenderedTree =
  | RenderedNode
  | string
  | null
  | (RenderedNode | string)[];

/**
 * Every rendered node of a host type, in render order. Skia's `<Path>` and
 * `<Circle>` reject a testID, so their paint props are only reachable by
 * walking the tree.
 *
 * @example
 * const [stroke] = findAllRenderedByType(toJSON(), "skPath");
 */
export const findAllRenderedByType = (
  tree: RenderedTree,
  type: string,
): RenderedNode[] => {
  if (!tree || typeof tree === "string") {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap((node) => findAllRenderedByType(node, type));
  }

  return [
    ...(tree.type === type ? [tree] : []),
    ...findAllRenderedByType(tree.children, type),
  ];
};

/**
 * The nearest native view around a node, past the wrappers React Native, the
 * styled components and the mocks put in between. Null when there's none.
 *
 * @example
 * const row = hostParentOf(screen.getByTestId("icon-button-buy"));
 */
export const hostParentOf = (
  node: ReactTestInstance | null | undefined,
): ReactTestInstance | null => {
  let ancestor = node?.parent ?? null;
  while (ancestor && typeof ancestor.type !== "string") {
    ancestor = ancestor.parent;
  }
  return ancestor;
};

/**
 * The `className` a node was rendered with. NativeWind doesn't apply classes
 * in tests, and a TouchableOpacity keeps `className` on itself instead of
 * handing it to its native view, so this walks up from the node to the first
 * element that carries one.
 *
 * @example
 * expect(classNameOf(screen.getByTestId("token-option-USDC"))).toContain("mb-6");
 */
export const classNameOf = (node: ReactTestInstance): string | undefined => {
  let current: ReactTestInstance | null = node;
  while (current && typeof current.props.className !== "string") {
    current = current.parent;
  }
  return current?.props.className as string | undefined;
};

export const renderWithProviders: RenderWithProviderType = (component) => {
  try {
    // The `wrapper` option (rather than wrapping the element inline) keeps
    // the providers in place across `rerender` calls too.
    return render(React.Children.only(component), { wrapper: AllProviders });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error rendering component:", error);
    throw error;
  }
};
