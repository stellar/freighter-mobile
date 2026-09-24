import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import CustomNavigationHeader from "components/layout/CustomNavigationHeader";
import HomeScreenHeader from "components/screens/HomeScreen/HomeScreenHeader";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/** Minimal shape the header reads: navigation.canGoBack plus options. */
const headerProps = {
  navigation: { canGoBack: () => false, goBack: jest.fn() },
  options: { title: "Screen" },
  route: { key: "route", name: "Screen" },
} as unknown as NativeStackHeaderProps;

const classNamesIn = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(classNamesIn);
  if (!node || typeof node !== "object") return [];

  const el = node as { props?: { className?: unknown }; children?: unknown };
  const own =
    typeof el.props?.className === "string" ? [el.props.className] : [];

  return [...own, ...classNamesIn(el.children)];
};

const headers = [
  { name: "CustomNavigationHeader", Header: CustomNavigationHeader },
  { name: "HomeScreenHeader", Header: HomeScreenHeader },
];

describe.each(headers)("$name", ({ Header }) => {
  it("paints itself with the page color rather than a surface color", () => {
    // A header sits flush against the screen body. Painting it with the
    // surface token leaves a visible band across the top of the screen,
    // because the page is Colors/Base/0 and surfaces are a different grey.
    const classNames = classNamesIn(
      renderWithProviders(<Header {...headerProps} />).toJSON(),
    );

    expect(classNames.some((name) => name.includes("bg-base-0"))).toBe(true);
  });
});
