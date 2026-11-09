import { render, screen } from "@testing-library/react-native";
import Icon from "components/sds/Icon";
import { MAIN_TAB_ROUTES } from "config/routes";
import { renderTabBarIcon } from "navigators/tabBarIcons";

// Neither Icon's defaults (24pt, the brand blue) nor the bar's 28pt, so an
// icon that kept a size or colour of its own can't pass.
const SIZE = 31;
const COLOR = "#123456";

/**
 * What each tab draws, from Figma's Tab Bar Buttons (?node-id=3487-68630).
 * The stroked glyphs take a 2pt stroke at the size they're drawn, and the
 * filled ones take none.
 */
const CASES = [
  {
    tab: "History",
    route: MAIN_TAB_ROUTES.TAB_HISTORY,
    focused: false,
    glyph: { name: "ClockRewind", strokeWidth: 2 },
  },
  {
    tab: "History",
    route: MAIN_TAB_ROUTES.TAB_HISTORY,
    focused: true,
    glyph: { name: "ClockRewind", strokeWidth: 2 },
  },
  {
    tab: "Home",
    route: MAIN_TAB_ROUTES.TAB_HOME,
    focused: false,
    glyph: { name: "HomeFilled" },
  },
  {
    tab: "Home",
    route: MAIN_TAB_ROUTES.TAB_HOME,
    focused: true,
    glyph: { name: "HomeFilled" },
  },
  {
    tab: "Discover",
    route: MAIN_TAB_ROUTES.TAB_DISCOVERY,
    focused: false,
    glyph: { name: "Compass03", strokeWidth: 2 },
  },
  {
    tab: "Discover",
    route: MAIN_TAB_ROUTES.TAB_DISCOVERY,
    focused: true,
    glyph: { name: "Compass03Filled" },
  },
];

describe("renderTabBarIcon", () => {
  it.each(CASES)(
    "draws $tab as $glyph.name in the size and color it's given, focused: $focused",
    ({ route, focused, glyph }) => {
      render(renderTabBarIcon(route, { focused, color: COLOR, size: SIZE }));

      // Every .svg is the same mock in Jest, so the glyph is told apart by
      // the name Icon draws it under.
      expect(screen.UNSAFE_getByType(Icon.Component).props).toEqual({
        ...glyph,
        size: SIZE,
        color: COLOR,
      });
    },
  );

  it.each(CASES)(
    "draws nothing behind $tab's glyph, focused: $focused, so the pill's selection shows through",
    ({ route, focused }) => {
      render(renderTabBarIcon(route, { focused, color: COLOR, size: SIZE }));

      // The glyph is the whole tree: no box around it paints a background.
      expect(screen.toJSON()).toMatchObject({
        type: "View",
        props: { testID: "SvgMock" },
      });
    },
  );
});
