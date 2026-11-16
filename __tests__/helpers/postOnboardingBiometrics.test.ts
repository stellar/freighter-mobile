import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BiometricsSource } from "config/constants";
import {
  AUTH_STACK_ROUTES,
  type AuthStackParamList,
  type RootStackParamList,
} from "config/routes";
import { AUTH_STATUS } from "config/types";
import { triggerFaceIdOnboarding } from "helpers/postOnboardingBiometrics";
import * as Keychain from "react-native-keychain";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
  secureDataStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    remove: jest.fn(),
  },
}));

type Navigation = NativeStackNavigationProp<
  RootStackParamList & AuthStackParamList
>;

describe("triggerFaceIdOnboarding", () => {
  const navigate = jest.fn();
  const navigation = { navigate } as unknown as Navigation;
  const checkBiometrics = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    navigate.mockReset();
    // The device has Face ID, the wallet hasn't turned it on, and the prompt
    // has never been answered.
    checkBiometrics.mockResolvedValue(Keychain.BIOMETRY_TYPE.FACE_ID);
    (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens the biometrics prompt on an unlocked launch", async () => {
    triggerFaceIdOnboarding(
      navigation,
      AUTH_STATUS.AUTHENTICATED,
      checkBiometrics,
      false,
      false,
    );

    await jest.runAllTimersAsync();

    expect(navigate).toHaveBeenCalledWith(
      AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN,
      { source: BiometricsSource.POST_ONBOARDING },
    );
  });

  it("leaves the prompt for the next launch when the Ethena launch promo opens on this one", async () => {
    triggerFaceIdOnboarding(
      navigation,
      AUTH_STATUS.AUTHENTICATED,
      checkBiometrics,
      false,
      true,
    );

    await jest.runAllTimersAsync();

    expect(navigate).not.toHaveBeenCalled();
  });
});
