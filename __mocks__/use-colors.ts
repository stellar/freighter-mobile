export const mockUseColors = () => {
  jest.mock("hooks/useColors", () => () => ({
    themeColors: {
      background: {
        primary: "#fcfcfc",
        secondary: "#f8f8f8",
        tertiary: "#f3f3f3",
      },
      foreground: {
        primary: "#000",
        secondary: "#666",
      },
      border: {
        primary: "#e2e2e2",
      },
      base: {
        1: "#000000",
      },
      text: {
        secondary: "#6f6f6f",
      },
      gray: {
        9: "#8f8f8f",
      },
      red: {
        9: "#e5484d",
      },
      amber: {
        9: "#ffb224",
      },
      lilac: { 11: "#9b59b6" },
    },
  }));
};
