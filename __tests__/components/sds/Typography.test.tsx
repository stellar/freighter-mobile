import { fireEvent, act } from "@testing-library/react-native";
import {
  Display,
  DisplaySize,
  FontWeight,
  Text,
  TextSize,
} from "components/sds/Typography";
import { getTheme } from "config/theme";
import { fsValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Linking } from "react-native";
import * as RN from "react-native";

// jest's react-native preset reports no device scheme, so components resolve
// DEFAULT_COLOR_SCHEME. Assertions that read a resolved color use this.
const LIGHT_THEME = getTheme("light");

// Dark text differs from the light default these tests render under, so an
// assertion on it proves the color prop took effect rather than the fallback.
const CUSTOM_COLOR = getTheme("dark").colors.text.secondary;

describe("Typography", () => {
  describe("Display", () => {
    it("renders with default props", () => {
      const { getByText } = renderWithProviders(<Display>Test Text</Display>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = renderWithProviders(
        <Display size="xl">Large Text</Display>,
      );
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = renderWithProviders(
        <Display weight="bold">Bold Text</Display>,
      );
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = renderWithProviders(
        <Display color={CUSTOM_COLOR}>Custom Color</Display>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = renderWithProviders(
        <Display size="lg" weight="semiBold" color={CUSTOM_COLOR}>
          Custom Text
        </Display>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });

    it("applies correct default styles", () => {
      const { getByText } = renderWithProviders(<Display>Test Text</Display>);
      const element = getByText("Test Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(32), // sm size
        lineHeight: fsValue(40),
        fontWeight: "400", // regular weight
        color: LIGHT_THEME.colors.text.primary,
      });
    });

    it("uses the static Funnel Sans file for the display family", () => {
      const { getByText } = renderWithProviders(
        <Display sm medium family="funnelSans">
          Display Text
        </Display>,
      );
      const element = getByText("Display Text");

      // Static weights carry their own weight, so none is requested.
      expect(element.props.style).toMatchObject({
        fontFamily: "FunnelSans-Medium",
        fontWeight: "normal",
        fontSize: fsValue(32),
        lineHeight: fsValue(40),
      });
    });

    it("applies correct custom styles", () => {
      const { getByText } = renderWithProviders(
        <Display size="xl" weight="bold" color={CUSTOM_COLOR}>
          Custom Text
        </Display>,
      );
      const element = getByText("Custom Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(56), // xl size
        lineHeight: fsValue(64),
        fontWeight: "700", // bold weight
        color: CUSTOM_COLOR,
      });
    });

    it("applies correct styles for each size", () => {
      const sizes = {
        xl: { fontSize: 56, lineHeight: 64 },
        lg: { fontSize: 48, lineHeight: 56 },
        md: { fontSize: 40, lineHeight: 48 },
        sm: { fontSize: 32, lineHeight: 40 },
        xs: { fontSize: 24, lineHeight: 32 },
      };

      Object.entries(sizes).forEach(([size, metrics]) => {
        const { getByText } = renderWithProviders(
          <Display size={size as DisplaySize}>{size} size</Display>,
        );
        const element = getByText(`${size} size`);

        expect(element.props.style).toMatchObject({
          fontSize: fsValue(metrics.fontSize),
          lineHeight: fsValue(metrics.lineHeight),
        });
      });
    });

    it("applies correct styles for each weight", () => {
      const weights = {
        light: "300",
        regular: "400",
        medium: "500",
        semiBold: "600",
        bold: "700",
      };

      Object.entries(weights).forEach(([weight, value]) => {
        const { getByText } = renderWithProviders(
          <Display weight={weight as FontWeight}>{weight} weight</Display>,
        );
        const element = getByText(`${weight} weight`);

        expect(element.props.style).toMatchObject({
          fontWeight: value,
        });
      });
    });

    describe("Size handling", () => {
      it("uses explicit size prop", () => {
        const { getByText } = renderWithProviders(
          <Display size="xl">Explicit Size</Display>,
        );
        const element = getByText("Explicit Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(56), // xl size
          lineHeight: fsValue(64),
        });
      });

      it("uses size shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display xl>Shorthand Size</Display>,
        );
        const element = getByText("Shorthand Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(56), // xl size
          lineHeight: fsValue(64),
        });
      });

      it("prioritizes explicit size over shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display size="xl" sm>
            Explicit Priority
          </Display>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(56), // xl size
          lineHeight: fsValue(64),
        });
      });

      it("defaults to sm size", () => {
        const { getByText } = renderWithProviders(
          <Display>Default Size</Display>,
        );
        const element = getByText("Default Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(32), // sm size
          lineHeight: fsValue(40),
        });
      });
    });

    describe("Weight handling", () => {
      it("uses explicit weight prop", () => {
        const { getByText } = renderWithProviders(
          <Display weight="bold">Explicit Weight</Display>,
        );
        const element = getByText("Explicit Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("uses weight shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display bold>Shorthand Weight</Display>,
        );
        const element = getByText("Shorthand Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("prioritizes explicit weight over shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display weight="bold" light>
            Explicit Priority
          </Display>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("defaults to regular weight", () => {
        const { getByText } = renderWithProviders(
          <Display>Default Weight</Display>,
        );
        const element = getByText("Default Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "400", // regular weight
        });
      });
    });

    describe("Color handling", () => {
      it("uses explicit color prop", () => {
        const { getByText } = renderWithProviders(
          <Display color={CUSTOM_COLOR}>Explicit Color</Display>,
        );
        const element = getByText("Explicit Color");
        expect(element.props.style).toMatchObject({
          color: CUSTOM_COLOR,
        });
      });

      it("uses primary color shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display primary>Primary Color</Display>,
        );
        const element = getByText("Primary Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.primary,
        });
      });

      it("uses secondary color shorthand", () => {
        const { getByText } = renderWithProviders(
          <Display secondary>Secondary Color</Display>,
        );
        const element = getByText("Secondary Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.secondary,
        });
      });

      it("prioritizes explicit color over shorthand", () => {
        const customColor = "#FF0000";
        const { getByText } = renderWithProviders(
          <Display color={customColor} primary secondary>
            Explicit Priority
          </Display>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          color: customColor,
        });
      });

      it("defaults to primary color", () => {
        const { getByText } = renderWithProviders(
          <Display>Default Color</Display>,
        );
        const element = getByText("Default Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.primary,
        });
      });
    });

    describe("Responsive text handling", () => {
      it("passes through adjustsFontSizeToFit prop", () => {
        const { getByText } = renderWithProviders(
          <Display adjustsFontSizeToFit>Responsive Text</Display>,
        );
        const element = getByText("Responsive Text");
        expect(element.props.adjustsFontSizeToFit).toBe(true);
      });

      it("passes through numberOfLines prop", () => {
        const { getByText } = renderWithProviders(
          <Display numberOfLines={1}>Single Line</Display>,
        );
        const element = getByText("Single Line");
        expect(element.props.numberOfLines).toBe(1);
      });

      it("passes through minimumFontScale prop", () => {
        const { getByText } = renderWithProviders(
          <Display minimumFontScale={0.6}>Scaled Text</Display>,
        );
        const element = getByText("Scaled Text");
        expect(element.props.minimumFontScale).toBe(0.6);
      });

      it("works with all responsive props together", () => {
        const { getByText } = renderWithProviders(
          <Display
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.6}
          >
            Combined Responsive
          </Display>,
        );
        const element = getByText("Combined Responsive");
        expect(element.props.adjustsFontSizeToFit).toBe(true);
        expect(element.props.numberOfLines).toBe(1);
        expect(element.props.minimumFontScale).toBe(0.6);
      });
    });
  });

  describe("Text", () => {
    it("renders with default props", () => {
      const { getByText } = renderWithProviders(<Text>Test Text</Text>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = renderWithProviders(
        <Text size="xl">Large Text</Text>,
      );
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = renderWithProviders(
        <Text weight="bold">Bold Text</Text>,
      );
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = renderWithProviders(
        <Text color={CUSTOM_COLOR}>Custom Color</Text>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders vertically centered", () => {
      const { getByText } = renderWithProviders(
        <Text isVerticallyCentered>Centered Text</Text>,
      );
      expect(getByText("Centered Text")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = renderWithProviders(
        <Text
          size="lg"
          weight="semiBold"
          color={CUSTOM_COLOR}
          isVerticallyCentered
        >
          Custom Text
        </Text>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });

    it("applies correct default styles", () => {
      const { getByText } = renderWithProviders(<Text>Test Text</Text>);
      const element = getByText("Test Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(16), // md size
        lineHeight: fsValue(24),
        fontWeight: "400", // regular weight
        color: LIGHT_THEME.colors.text.primary,
      });
    });

    it("applies correct custom styles", () => {
      const { getByText } = renderWithProviders(
        <Text size="xl" weight="bold" color={CUSTOM_COLOR} isVerticallyCentered>
          Custom Text
        </Text>,
      );
      const element = getByText("Custom Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(20), // xl size
        lineHeight: fsValue(28),
        fontWeight: "700", // bold weight
        color: CUSTOM_COLOR,
        display: "flex",
        alignItems: "center",
        height: fsValue(28),
      });
    });

    it("applies correct styles for each size", () => {
      const sizes = {
        xl: { fontSize: 20, lineHeight: 28 },
        lg: { fontSize: 18, lineHeight: 26 },
        md: { fontSize: 16, lineHeight: 24 },
        sm: { fontSize: 14, lineHeight: 22 },
        xs: { fontSize: 12, lineHeight: 20 },
      };

      Object.entries(sizes).forEach(([size, metrics]) => {
        const { getByText } = renderWithProviders(
          <Text size={size as TextSize}>{size} size</Text>,
        );
        const element = getByText(`${size} size`);

        expect(element.props.style).toMatchObject({
          fontSize: fsValue(metrics.fontSize),
          lineHeight: fsValue(metrics.lineHeight),
        });
      });
    });

    it("applies vertical centering styles correctly", () => {
      const { getByText } = renderWithProviders(
        <Text size="md" isVerticallyCentered>
          Centered Text
        </Text>,
      );
      const element = getByText("Centered Text");

      expect(element.props.style).toMatchObject({
        display: "flex",
        alignItems: "center",
        height: fsValue(24), // md line height
      });
    });

    describe("Size handling", () => {
      it("uses explicit size prop", () => {
        const { getByText } = renderWithProviders(
          <Text size="xl">Explicit Size</Text>,
        );
        const element = getByText("Explicit Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(20), // xl size
          lineHeight: fsValue(28),
        });
      });

      it("uses size shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text xl>Shorthand Size</Text>,
        );
        const element = getByText("Shorthand Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(20), // xl size
          lineHeight: fsValue(28),
        });
      });

      it("prioritizes explicit size over shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text size="xl" sm>
            Explicit Priority
          </Text>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(20), // xl size
          lineHeight: fsValue(28),
        });
      });

      it("defaults to md size", () => {
        const { getByText } = renderWithProviders(<Text>Default Size</Text>);
        const element = getByText("Default Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(16), // md size
          lineHeight: fsValue(24),
        });
      });
    });

    describe("Weight handling", () => {
      it("uses explicit weight prop", () => {
        const { getByText } = renderWithProviders(
          <Text weight="bold">Explicit Weight</Text>,
        );
        const element = getByText("Explicit Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("uses weight shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text bold>Shorthand Weight</Text>,
        );
        const element = getByText("Shorthand Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("prioritizes explicit weight over shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text weight="bold" light>
            Explicit Priority
          </Text>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("defaults to regular weight", () => {
        const { getByText } = renderWithProviders(<Text>Default Weight</Text>);
        const element = getByText("Default Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "400", // regular weight
        });
      });
    });

    describe("Vertical centering", () => {
      it("applies vertical centering styles when enabled", () => {
        const { getByText } = renderWithProviders(
          <Text isVerticallyCentered>Centered Text</Text>,
        );
        const element = getByText("Centered Text");
        expect(element.props.style).toMatchObject({
          display: "flex",
          alignItems: "center",
          height: fsValue(24), // md line height
        });
      });

      it("does not apply vertical centering styles when disabled", () => {
        const { getByText } = renderWithProviders(
          <Text>Non-Centered Text</Text>,
        );
        const element = getByText("Non-Centered Text");
        expect(element.props.style).not.toHaveProperty("display");
        expect(element.props.style).not.toHaveProperty("alignItems");
        expect(element.props.style).not.toHaveProperty("height");
      });
    });

    describe("Color handling", () => {
      it("uses explicit color prop", () => {
        const { getByText } = renderWithProviders(
          <Text color={CUSTOM_COLOR}>Explicit Color</Text>,
        );
        const element = getByText("Explicit Color");
        expect(element.props.style).toMatchObject({
          color: CUSTOM_COLOR,
        });
      });

      it("uses primary color shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text primary>Primary Color</Text>,
        );
        const element = getByText("Primary Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.primary,
        });
      });

      it("uses secondary color shorthand", () => {
        const { getByText } = renderWithProviders(
          <Text secondary>Secondary Color</Text>,
        );
        const element = getByText("Secondary Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.secondary,
        });
      });

      it("prioritizes explicit color over shorthand", () => {
        const customColor = "#FF0000";
        const { getByText } = renderWithProviders(
          <Text color={customColor} primary secondary>
            Explicit Priority
          </Text>,
        );
        const element = getByText("Explicit Priority");
        expect(element.props.style).toMatchObject({
          color: customColor,
        });
      });

      it("defaults to primary color", () => {
        const { getByText } = renderWithProviders(<Text>Default Color</Text>);
        const element = getByText("Default Color");
        expect(element.props.style).toMatchObject({
          color: LIGHT_THEME.colors.text.primary,
        });
      });
    });

    it("handles platform-specific font families", () => {
      const { getByText } = renderWithProviders(
        <Text weight="bold">Android Text</Text>,
      );
      const element = getByText("Android Text");

      expect(element.props.style.fontFamily).toBe("Inter-Variable");
    });

    it("opens the link when the text is pressed", async () => {
      const { getByText } = renderWithProviders(
        <Text url="https://example.com">Link Text</Text>,
      );
      const element = getByText("Link Text");

      // eslint-disable-next-line @typescript-eslint/require-await
      await act(async () => {
        fireEvent.press(element);
      });

      expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
    });
  });

  describe("Color scheme", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const renderIn = (scheme: "light" | "dark", label: string) => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);

      return renderWithProviders(<Display>{label}</Display>);
    };

    it("colors Display text from the light theme on a light device", () => {
      const { getByText } = renderIn("light", "Light Display");

      expect(getByText("Light Display").props.style).toMatchObject({
        color: getTheme("light").colors.text.primary,
      });
    });

    it("colors Display text from the dark theme on a dark device", () => {
      const { getByText } = renderIn("dark", "Dark Display");

      expect(getByText("Dark Display").props.style).toMatchObject({
        color: getTheme("dark").colors.text.primary,
      });
    });

    it("colors Text from the light theme on a light device", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      const { getByText } = renderWithProviders(<Text>Light Text</Text>);

      expect(getByText("Light Text").props.style).toMatchObject({
        color: getTheme("light").colors.text.primary,
      });
    });

    it("colors the secondary shorthand from the active scheme", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      const { getByText } = renderWithProviders(
        <Text secondary>Secondary</Text>,
      );

      expect(getByText("Secondary").props.style).toMatchObject({
        color: getTheme("light").colors.text.secondary,
      });
    });

    it("lets an explicit color prop override the active scheme", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      const { getByText } = renderWithProviders(
        <Text color={getTheme("dark").colors.text.primary}>Explicit</Text>,
      );

      expect(getByText("Explicit").props.style).toMatchObject({
        color: getTheme("dark").colors.text.primary,
      });
    });
  });
});
