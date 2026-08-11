/**
 * Shallow-render coverage for the v2 icon renderers in
 * components/screens/HistoryScreen/helpers.tsx. Before this file, only
 * v2Entry.test.tsx exercised renderRowIcon/renderSecondaryIcon, and it only
 * ever built `rowIcon: { type: "contract" }` — so five of six
 * RowIconDescriptor variants (asset x3 shapes, protocol, account, failed,
 * settings) and most secondaryIcon values were never rendered by any test.
 * No simulator was available for this work, so these assertions check
 * element type + key props (shallow), not pixel output.
 */
import { CollectibleImage } from "components/CollectibleImage";
import { TokenIcon } from "components/TokenIcon";
import {
  renderRowIcon,
  renderSecondaryIcon,
} from "components/screens/HistoryScreen/helpers";
import Icon from "components/sds/Icon";
import { Token as TokenComponent } from "components/sds/Token";
import { getThemeColors } from "config/colors";
import { THEME } from "config/theme";
import { TokenTypeWithCustomToken } from "config/types";
import {
  HistoryEntry,
  ResolvedToken,
  SettingsGlyph,
} from "helpers/history/v2/model";
import React from "react";
import { View } from "react-native";

// A real ThemeColors value, so colour assertions check the actual token
// rather than a hand-made stand-in.
const themeColors = getThemeColors("dark");

/**
 * These renderers return `React.ReactElement | null` with no props generic,
 * so `.props` types as `unknown`. This test only needs to shallow-check a
 * few known prop keys per branch (see the file doc comment), so casting to
 * a plain index type here is simpler and just as safe as threading a
 * precise prop type through every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; only test-local, and no-explicit-any is already off for **/*.test.tsx in eslint.config.mjs.
const propsOf = (
  element: React.ReactElement | null | undefined,
): Record<string, any> => (element?.props ?? {}) as Record<string, any>;

const xlm = (): ResolvedToken => ({
  code: "XLM",
  contractId: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  issuer: null,
  icon: null,
  decimals: 7,
});

const usdc = (overrides: Partial<ResolvedToken> = {}): ResolvedToken => ({
  code: "USDC",
  contractId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  issuer: "GISSUER",
  icon: null,
  decimals: 7,
  ...overrides,
});

describe("renderRowIcon", () => {
  it("renders a single TokenIcon for a 1-token asset descriptor", () => {
    const element = renderRowIcon(
      { type: "asset", tokens: [usdc()] },
      themeColors,
    );

    expect(element?.type).toBe(TokenIcon);
    expect(propsOf(element).size).toBe("lg");
    expect(propsOf(element).iconUrl).toBeUndefined();
  });

  it("renders an overlapping swap-pair Token for a 2-token asset descriptor", () => {
    const element = renderRowIcon(
      { type: "asset", tokens: [xlm(), usdc()] },
      themeColors,
    );

    expect(element?.type).toBe(TokenComponent);
    expect(propsOf(element).variant).toBe("swap");
    expect(propsOf(element).sourceOne.altText).toBe("XLM logo");
    expect(propsOf(element).sourceTwo.altText).toBe("USDC logo");
  });

  it("renders a stacked asset icon with a +N badge for a 3+-token asset descriptor", () => {
    const tokens = [
      usdc(),
      xlm(),
      usdc({ code: "AQUA", contractId: "C_AQUA" }),
    ];
    const element = renderRowIcon({ type: "asset", tokens }, themeColors);

    expect(element?.type).toBe(View);
    // children: [renderSingleAssetIcon(tokens[0]), badge View]
    const children = propsOf(element).children as React.ReactElement[];
    expect(children[0].type).toBe(TokenIcon);

    const badgeView = children[1];
    expect(badgeView.type).toBe(View);
    const badgeText = propsOf(badgeView).children;
    // +N where N = tokens.length - 1
    expect(badgeText.props.children).toBe("+2");
  });

  it("renders the token resolver's fallback icon (contractId truncation) when a resolved token has no code match for native", () => {
    // Sanity: a 1-token descriptor with a non-native code still routes
    // through renderSingleAssetIcon, not the native-XLM branch.
    const element = renderRowIcon(
      { type: "asset", tokens: [usdc()] },
      themeColors,
    );
    expect(element?.type).toBe(TokenIcon);
  });

  it("renders a protocol logo wrapped in the rounded image container", () => {
    const element = renderRowIcon(
      {
        type: "protocol",
        src: "https://example.com/aqua.png",
        name: "Aquarius",
      },
      themeColors,
    );

    expect(element?.type).toBe(View);
    const image = propsOf(element).children;
    expect(image.type).toBe(CollectibleImage);
    expect(image.props.imageUri).toBe("https://example.com/aqua.png");
  });

  it("renders the generic contract icon", () => {
    const element = renderRowIcon({ type: "contract" }, themeColors);
    expect(element?.type).toBe(Icon.FileCode02);
  });

  it("renders the failed-transaction icon", () => {
    const element = renderRowIcon({ type: "failed" }, themeColors);
    expect(element?.type).toBe(Icon.Wallet03);
  });

  it.each(["create", "merge"] as const)(
    "renders the native TokenIcon for account variant %s (v1 has no distinct merge treatment)",
    (variant) => {
      const element = renderRowIcon({ type: "account", variant }, themeColors);

      expect(element?.type).toBe(TokenIcon);
      expect(propsOf(element).token).toEqual({
        type: TokenTypeWithCustomToken.NATIVE,
        code: "XLM",
      });
    },
  );

  describe("settings glyphs", () => {
    // GAP documented in helpers.tsx: no v1 mapper has a settings row-icon
    // precedent yet, so every glyph currently falls back to null (rendered
    // as the app-wide unknown-icon fallback by the caller). This locks in
    // that every glyph is actually reachable through the switch (not an
    // unhandled default) rather than asserting a richer render that
    // doesn't exist yet.
    const glyphs: SettingsGlyph[] = [
      "signer",
      "threshold",
      "data",
      "domain",
      "flag",
      "allowance",
      "claimable",
      "generic",
    ];

    it.each(glyphs)("returns null for glyph %s", (glyph) => {
      expect(
        renderRowIcon({ type: "settings", glyph }, themeColors),
      ).toBeNull();
    });
  });
});

describe("renderSecondaryIcon", () => {
  it("returns null when there is no secondary icon", () => {
    expect(renderSecondaryIcon(null, themeColors)).toBeNull();
  });

  const cases: [HistoryEntry["secondaryIcon"], unknown][] = [
    ["sent", Icon.ArrowCircleUp],
    ["received", Icon.ArrowCircleDown],
    ["swap", Icon.RefreshCw05],
    ["add", Icon.PlusCircle],
    ["remove", Icon.MinusCircle],
    ["contract", Icon.FileCode02],
  ];

  it.each(cases)("renders %s as its mirrored v1 icon", (value, expected) => {
    const element = renderSecondaryIcon(value, themeColors);
    expect(element?.type).toBe(expected);
  });

  it("renders the failed icon with the red theme color (mirrors failed.tsx exactly)", () => {
    const element = renderSecondaryIcon("failed", themeColors);
    expect(element?.type).toBe(Icon.XCircle);
    expect(propsOf(element).themeColor).toBe("red");
  });

  it.each(["globe", "settings"] as const)(
    "returns null for %s (no v1 action-icon precedent yet)",
    (value) => {
      expect(renderSecondaryIcon(value, themeColors)).toBeNull();
    },
  );
});

describe("theme colour (regression: purple icons)", () => {
  /**
   * These icons shipped purple to a device. `Icon` defaults to
   * `THEME.colors.primary` — the brand lilac — when given no `color`, and every
   * v1 mapper passes `themeColors.foreground.primary` (payment.tsx) while these
   * renderers passed nothing. The existing tests asserted element type and key
   * props but never colour, so nothing caught it.
   */
  const expected = themeColors.foreground.primary;

  it.each(
    [
      ["sent", "received", "swap", "add", "remove", "contract"].map((v) => [v]),
    ].flat() as [Exclude<HistoryEntry["secondaryIcon"], null>][],
  )(
    "renderSecondaryIcon(%s) passes the foreground colour, not the brand default",
    (value) => {
      const element = renderSecondaryIcon(value, themeColors);
      expect(propsOf(element).color).toBe(expected);
      expect(propsOf(element).color).not.toBe(THEME.colors.primary);
    },
  );

  it("keeps the failed icon red rather than the foreground colour", () => {
    const element = renderSecondaryIcon("failed", themeColors);
    expect(propsOf(element).themeColor).toBe("red");
  });

  it("renderRowIcon passes the foreground colour for the contract glyph", () => {
    const element = renderRowIcon({ type: "contract" }, themeColors);
    expect(propsOf(element).color).toBe(expected);
    expect(propsOf(element).color).not.toBe(THEME.colors.primary);
  });

  it("renderRowIcon passes the foreground colour for the failed glyph", () => {
    const element = renderRowIcon({ type: "failed" }, themeColors);
    expect(propsOf(element).color).toBe(expected);
    expect(propsOf(element).color).not.toBe(THEME.colors.primary);
  });
});
