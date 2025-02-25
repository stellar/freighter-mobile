import { render } from "@testing-library/react-native";
import {
  Display,
  DisplaySize,
  FontWeight,
  Text,
  TextSize,
} from "components/sds/Typography";
import { THEME } from "config/sds/theme";
import { fsValue } from "helpers/dimensions";
import React from "react";

describe("Typography", () => {
  describe("Display", () => {
    it("renders with default props", () => {
      const { getByText } = render(<Display>Test Text</Display>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = render(<Display size="xl">Large Text</Display>);
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = render(<Display weight="bold">Bold Text</Display>);
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = render(
        <Display color={THEME.colors.text.secondary}>Custom Color</Display>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = render(
        <Display
          size="lg"
          weight="semiBold"
          color={THEME.colors.text.secondary}
        >
          Custom Text
        </Display>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });

    it("applies correct default styles", () => {
      const { getByText } = render(<Display>Test Text</Display>);
      const element = getByText("Test Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(32), // sm size
        lineHeight: fsValue(40),
        fontWeight: "400", // regular weight
        color: THEME.colors.text.primary,
      });
    });

    it("applies correct custom styles", () => {
      const { getByText } = render(
        <Display size="xl" weight="bold" color={THEME.colors.text.secondary}>
          Custom Text
        </Display>,
      );
      const element = getByText("Custom Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(56), // xl size
        lineHeight: fsValue(64),
        fontWeight: "700", // bold weight
        color: THEME.colors.text.secondary,
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
        const { getByText } = render(
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
        const { getByText } = render(
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
        const { getByText } = render(
          <Display size="xl">Explicit Size</Display>,
        );
        const element = getByText("Explicit Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(56), // xl size
          lineHeight: fsValue(64),
        });
      });

      it("uses size shorthand", () => {
        const { getByText } = render(<Display xl>Shorthand Size</Display>);
        const element = getByText("Shorthand Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(56), // xl size
          lineHeight: fsValue(64),
        });
      });

      it("prioritizes explicit size over shorthand", () => {
        const { getByText } = render(
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
        const { getByText } = render(<Display>Default Size</Display>);
        const element = getByText("Default Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(32), // sm size
          lineHeight: fsValue(40),
        });
      });
    });

    describe("Weight handling", () => {
      it("uses explicit weight prop", () => {
        const { getByText } = render(
          <Display weight="bold">Explicit Weight</Display>,
        );
        const element = getByText("Explicit Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("uses weight shorthand", () => {
        const { getByText } = render(<Display bold>Shorthand Weight</Display>);
        const element = getByText("Shorthand Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("prioritizes explicit weight over shorthand", () => {
        const { getByText } = render(
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
        const { getByText } = render(<Display>Default Weight</Display>);
        const element = getByText("Default Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "400", // regular weight
        });
      });
    });

    describe("Color handling", () => {
      it("uses explicit color prop", () => {
        const { getByText } = render(
          <Display color={THEME.colors.text.secondary}>Explicit Color</Display>,
        );
        const element = getByText("Explicit Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.secondary,
        });
      });

      it("uses primary color shorthand", () => {
        const { getByText } = render(<Display primary>Primary Color</Display>);
        const element = getByText("Primary Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.primary,
        });
      });

      it("uses secondary color shorthand", () => {
        const { getByText } = render(
          <Display secondary>Secondary Color</Display>,
        );
        const element = getByText("Secondary Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.secondary,
        });
      });

      it("prioritizes explicit color over shorthand", () => {
        const customColor = "#FF0000";
        const { getByText } = render(
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
        const { getByText } = render(<Display>Default Color</Display>);
        const element = getByText("Default Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.primary,
        });
      });
    });
  });

  describe("Text", () => {
    it("renders with default props", () => {
      const { getByText } = render(<Text>Test Text</Text>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = render(<Text size="xl">Large Text</Text>);
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = render(<Text weight="bold">Bold Text</Text>);
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = render(
        <Text color={THEME.colors.text.secondary}>Custom Color</Text>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders vertically centered", () => {
      const { getByText } = render(
        <Text isVerticallyCentered>Centered Text</Text>,
      );
      expect(getByText("Centered Text")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = render(
        <Text
          size="lg"
          weight="semiBold"
          color={THEME.colors.text.secondary}
          isVerticallyCentered
        >
          Custom Text
        </Text>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });

    it("applies correct default styles", () => {
      const { getByText } = render(<Text>Test Text</Text>);
      const element = getByText("Test Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(16), // md size
        lineHeight: fsValue(24),
        fontWeight: "400", // regular weight
        color: THEME.colors.text.primary,
      });
    });

    it("applies correct custom styles", () => {
      const { getByText } = render(
        <Text
          size="xl"
          weight="bold"
          color={THEME.colors.text.secondary}
          isVerticallyCentered
        >
          Custom Text
        </Text>,
      );
      const element = getByText("Custom Text");

      expect(element.props.style).toMatchObject({
        fontFamily: "Inter-Variable",
        fontSize: fsValue(20), // xl size
        lineHeight: fsValue(28),
        fontWeight: "700", // bold weight
        color: THEME.colors.text.secondary,
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
        const { getByText } = render(
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
      const { getByText } = render(
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
        const { getByText } = render(<Text size="xl">Explicit Size</Text>);
        const element = getByText("Explicit Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(20), // xl size
          lineHeight: fsValue(28),
        });
      });

      it("uses size shorthand", () => {
        const { getByText } = render(<Text xl>Shorthand Size</Text>);
        const element = getByText("Shorthand Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(20), // xl size
          lineHeight: fsValue(28),
        });
      });

      it("prioritizes explicit size over shorthand", () => {
        const { getByText } = render(
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
        const { getByText } = render(<Text>Default Size</Text>);
        const element = getByText("Default Size");
        expect(element.props.style).toMatchObject({
          fontSize: fsValue(16), // md size
          lineHeight: fsValue(24),
        });
      });
    });

    describe("Weight handling", () => {
      it("uses explicit weight prop", () => {
        const { getByText } = render(
          <Text weight="bold">Explicit Weight</Text>,
        );
        const element = getByText("Explicit Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("uses weight shorthand", () => {
        const { getByText } = render(<Text bold>Shorthand Weight</Text>);
        const element = getByText("Shorthand Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "700", // bold weight
        });
      });

      it("prioritizes explicit weight over shorthand", () => {
        const { getByText } = render(
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
        const { getByText } = render(<Text>Default Weight</Text>);
        const element = getByText("Default Weight");
        expect(element.props.style).toMatchObject({
          fontWeight: "400", // regular weight
        });
      });
    });

    describe("Vertical centering", () => {
      it("applies vertical centering styles when enabled", () => {
        const { getByText } = render(
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
        const { getByText } = render(<Text>Non-Centered Text</Text>);
        const element = getByText("Non-Centered Text");
        expect(element.props.style).not.toHaveProperty("display");
        expect(element.props.style).not.toHaveProperty("alignItems");
        expect(element.props.style).not.toHaveProperty("height");
      });
    });

    describe("Color handling", () => {
      it("uses explicit color prop", () => {
        const { getByText } = render(
          <Text color={THEME.colors.text.secondary}>Explicit Color</Text>,
        );
        const element = getByText("Explicit Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.secondary,
        });
      });

      it("uses primary color shorthand", () => {
        const { getByText } = render(<Text primary>Primary Color</Text>);
        const element = getByText("Primary Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.primary,
        });
      });

      it("uses secondary color shorthand", () => {
        const { getByText } = render(<Text secondary>Secondary Color</Text>);
        const element = getByText("Secondary Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.secondary,
        });
      });

      it("prioritizes explicit color over shorthand", () => {
        const customColor = "#FF0000";
        const { getByText } = render(
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
        const { getByText } = render(<Text>Default Color</Text>);
        const element = getByText("Default Color");
        expect(element.props.style).toMatchObject({
          color: THEME.colors.text.primary,
        });
      });
    });

    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-return */
    it("handles platform-specific font families", () => {
      jest.mock("react-native/Libraries/Utilities/Platform", () => ({
        select: jest.fn((obj) => obj.android),
      }));

      const { getByText } = render(<Text weight="bold">Android Text</Text>);
      const element = getByText("Android Text");

      expect(element.props.style.fontFamily).toBe("Inter-Bold");
    });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    /* eslint-enable @typescript-eslint/no-unsafe-return */
  });
});
