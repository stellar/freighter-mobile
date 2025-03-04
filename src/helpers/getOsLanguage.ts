import { I18nManager, Platform, Settings } from "react-native";

function getOSLanguage(): string | undefined {
  if (Platform.OS === "android") {
    const locale = I18nManager.getConstants().localeIdentifier;

    if (locale) {
      return locale.substring(0, 2);
    }
  }

  if (Platform.OS === "ios") {
    const deviceLanguage =
      (Settings.get("AppleLocale") as string) ||
      (Settings.get("AppleLanguages") as string[])[0];

    if (deviceLanguage) {
      return deviceLanguage.substring(0, 2);
    }
  }

  return "en";
}

export default getOSLanguage;
