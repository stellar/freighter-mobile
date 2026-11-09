import { fireEvent, render, screen } from "@testing-library/react-native";
import { EmptyState } from "components/EmptyState";
import { SPARKLE_GRAPHIC_SIZE } from "components/WalletSetupOverlay/SparkleGraphic";
import { getThemeColors } from "config/colors";
import { hostParentOf } from "helpers/testUtils";
import React from "react";
import * as RN from "react-native";
import { StyleSheet } from "react-native";
import { ReactTestInstance } from "react-test-renderer";

const CARD = "empty-state";

const styleOf = (node: ReactTestInstance | null | undefined) =>
  StyleSheet.flatten(node?.props.style) ?? {};

/** The file an image shows: Jest stands each asset in with its path. */
const fileOf = (node: ReactTestInstance) =>
  (node.props.source as { testUri: string }).testUri;

const renderCard = (
  props: Partial<React.ComponentProps<typeof EmptyState>> = {},
) =>
  render(
    <EmptyState
      title="Activate your wallet"
      description="Add at least 2 XLM to get started"
      testID={CARD}
      {...props}
    >
      <RN.Button title="Add XLM" onPress={jest.fn()} />
    </EmptyState>,
  );

describe("EmptyState", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the title, the description and the action", () => {
    const onPress = jest.fn();
    render(
      <EmptyState
        title="Collect your first NFT"
        description="Collectibles you own will appear here."
      >
        <RN.Button title="Add Collectible" onPress={onPress} />
      </EmptyState>,
    );

    expect(screen.getByText("Collect your first NFT")).toBeTruthy();
    expect(
      screen.getByText("Collectibles you own will appear here."),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Add Collectible"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders without a description", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.queryByText(/appear here/)).toBeNull();
  });

  // Figma's Empty card (?node-id=208-13041): 280pt tall, 16pt above and below
  // its contents, 24pt corners, and 16pt between the top block and the button.
  // The height is a minimum, so larger accessibility text grows the card
  // instead of spilling out of it.
  describe("card", () => {
    it("is 280pt tall with 24pt corners, padded 16pt above and below, its items centred", () => {
      renderCard();

      expect(styleOf(screen.getByTestId(CARD))).toMatchObject({
        minHeight: 280,
        borderRadius: 24,
        paddingVertical: 16,
        alignItems: "center",
        gap: 16,
      });
    });

    it("pads its sides 24pt by default, the tokens card's", () => {
      renderCard();

      expect(styleOf(screen.getByTestId(CARD))).toMatchObject({
        paddingHorizontal: 24,
      });
    });

    it("pads its sides as asked, for the collectibles card's 32pt", () => {
      renderCard({ contentPaddingHorizontal: 32 });

      expect(styleOf(screen.getByTestId(CARD))).toMatchObject({
        paddingHorizontal: 32,
      });
    });

    it("takes the caller's outer margins", () => {
      renderCard({ style: { marginHorizontal: -8, marginTop: -1 } });

      expect(styleOf(screen.getByTestId(CARD))).toMatchObject({
        marginHorizontal: -8,
        marginTop: -1,
        // ...on top of its own geometry.
        minHeight: 280,
      });
    });

    it("fills light mode's card with Figma's #F5F7F9", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      renderCard();

      expect(styleOf(screen.getByTestId(CARD)).backgroundColor).toBe("#F5F7F9");
    });

    it("leaves dark mode's card unfilled", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("dark");
      renderCard();

      expect(styleOf(screen.getByTestId(CARD)).backgroundColor).toBe(
        "transparent",
      );
    });

    // The card's gap only spaces its own children, so the top block and the
    // action both have to be one.
    it("puts the action in the card itself, under the top block", () => {
      renderCard();

      const card = screen.getByTestId(CARD);
      const topBlock = hostParentOf(screen.getByTestId(`${CARD}-icon`));

      let actionBox: ReactTestInstance | null = screen.getByText("Add XLM");
      while (actionBox && hostParentOf(actionBox) !== card) {
        actionBox = hostParentOf(actionBox);
      }

      expect(hostParentOf(topBlock)).toBe(card);
      expect(actionBox).toBeTruthy();
      expect(actionBox).not.toBe(topBlock);
    });
  });

  // The top block is the icon over the text, 8pt apart.
  describe("icon", () => {
    it("sits 8pt above the text, in a fully rounded circle padded 8pt", () => {
      renderCard();

      const circle = screen.getByTestId(`${CARD}-icon`);

      expect(styleOf(circle)).toMatchObject({
        padding: 8,
        borderRadius: 1000,
      });
      expect(styleOf(hostParentOf(circle))).toMatchObject({
        gap: 8,
        alignItems: "center",
        alignSelf: "stretch",
      });
    });

    // Blue/03 and Blue/02 in Figma: lilac 3 of the light palette and lilac 2
    // of the dark one.
    it.each([
      ["light", "#eef4ff"],
      ["dark", "#101a29"],
    ] as const)(
      "fills the circle in %s mode with %s and draws that mode's sparkle",
      (scheme, fill) => {
        jest.spyOn(RN, "useColorScheme").mockReturnValue(scheme);
        renderCard();

        expect(styleOf(screen.getByTestId(`${CARD}-icon`))).toMatchObject({
          backgroundColor: fill,
        });
        expect(fileOf(screen.getByTestId(`${CARD}-sparkle`))).toMatch(
          new RegExp(`wallet-setup-sparkle-${scheme}\\.png$`),
        );
      },
    );

    // Figma's "Group 19" is a 24.141 × 24 box with the sparkle's canvas at
    // inset 0 −11.48% −28.51% −11.48%: its glow runs past the box down and to
    // the sides, and nothing clips it.
    it("draws the sparkle's canvas from Figma's 24.141 × 24 box, 11.48% to its left", () => {
      renderCard();

      const sparkle = screen.getByTestId(`${CARD}-sparkle`);
      const canvas = hostParentOf(sparkle);
      const box = hostParentOf(canvas);

      expect(styleOf(sparkle)).toMatchObject({
        width: SPARKLE_GRAPHIC_SIZE.width,
        height: SPARKLE_GRAPHIC_SIZE.height,
      });
      expect(styleOf(canvas)).toMatchObject({ position: "absolute", top: 0 });
      expect(styleOf(canvas).left).toBeCloseTo(-24.141 * 0.1148, 2);
      expect(styleOf(box)).toMatchObject({ width: 24.141, height: 24 });
      expect(styleOf(box).overflow).not.toBe("hidden");
      expect(styleOf(screen.getByTestId(`${CARD}-icon`)).overflow).not.toBe(
        "hidden",
      );
    });
  });

  describe("text", () => {
    it("spans the card's width with 4pt between the title and the description", () => {
      renderCard();

      const block = hostParentOf(screen.getByText("Activate your wallet"));

      expect(styleOf(block)).toMatchObject({ gap: 4, alignSelf: "stretch" });
      expect(
        hostParentOf(screen.getByText("Add at least 2 XLM to get started")),
      ).toBe(block);
    });

    it("sets the title in Text/MD/600, primary and centred", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      renderCard();

      expect(styleOf(screen.getByText("Activate your wallet"))).toMatchObject({
        fontSize: 16,
        lineHeight: 24,
        fontWeight: "600",
        color: getThemeColors("light").text.primary,
        textAlign: "center",
      });
    });

    // TEXT_SIZES.sm is 14/22, so the card sets Figma's 20pt line itself.
    it("sets the description in Text/SM/400 on a 20pt line, secondary and centred", () => {
      jest.spyOn(RN, "useColorScheme").mockReturnValue("light");
      renderCard();

      expect(
        styleOf(screen.getByText("Add at least 2 XLM to get started")),
      ).toMatchObject({
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "400",
        color: getThemeColors("light").text.secondary,
        textAlign: "center",
      });
    });
  });
});
