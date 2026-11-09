import { ScreenTransition } from "config/routes";
import { getScanQRCodeScreenOptions } from "helpers/navigationOptions";

describe("getScanQRCodeScreenOptions", () => {
  it("slides up from the bottom, as a screen with an X does, with its own header", () => {
    const options = getScanQRCodeScreenOptions({ route: { params: {} } });

    expect(options.headerShown).toBe(false);
    expect(options.animation).toBe("slide_from_bottom");
  });

  it("still honours a transition passed in the route", () => {
    expect(
      getScanQRCodeScreenOptions({
        route: { params: { transition: ScreenTransition.Fade } },
      }).animation,
    ).toBe("fade");
  });
});
