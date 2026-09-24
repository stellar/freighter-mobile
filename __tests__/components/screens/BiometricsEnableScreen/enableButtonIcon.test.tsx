import { render } from "@testing-library/react-native";
import { BiometricsOnboardingScreen } from "components/screens/BiometricsEnableScreen/BiometricsEnableScreen";
import { getButtonColors } from "components/sds/Button/theme";
import React from "react";
import { BIOMETRY_TYPE } from "react-native-keychain";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ signUp: jest.fn() }),
}));

jest.mock("ducks/loginData", () => ({
  useLoginDataStore: () => ({ password: "", mnemonicPhrase: "" }),
}));

jest.mock("hooks/useSetupFailedToast", () => ({
  useSetupFailedToast: jest.fn(),
}));

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useBiometrics", () => ({
  useBiometrics: () => ({
    biometryType: "FaceID",
    enableBiometrics: jest.fn(),
    getBiometricButtonIcon: () => undefined,
  }),
}));

describe("BiometricsEnableScreen enable button", () => {
  it("shows the biometric glyph in the button's label color", () => {
    // The button is filled, so its label inverts against the page. An icon
    // pinned to one of the foreground grays sits next to that label at a
    // fraction of its contrast and reads as disabled; leaving the icon
    // uncolored lets Button tint it to the label instead.
    const { getAllByTestId } = render(
      <BiometricsOnboardingScreen
        route={
          {
            params: { biometryType: BIOMETRY_TYPE.FACE_ID },
          } as never
        }
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
      />,
    );

    const colors = getAllByTestId("SvgMock").map(
      (svg) => svg.props.color as string | undefined,
    );

    expect(colors).toContain(getButtonColors("light").secondary.text);
  });
});
