import getOSLanguage from "helpers/get-os-language";
import en from "i18n/locales/en/translations.json";
import pt from "i18n/locales/pt/translations.json";
import i18n, { CustomTypeOptions, ParseKeys } from "i18next";
import { initReactI18next } from "react-i18next";

export const defaultNS = "index";
export const resources = {
  en: {
    translations: en,
  },
  pt: {
    translations: pt,
  },
} as const;

export type TranslationsKeys = ParseKeys<
  (keyof CustomTypeOptions["resources"])[]
>;

i18n.use(initReactI18next).init({
  resources,
  lng: getOSLanguage(),
  fallbackLng: "en",
  ns: ["translations"],
  compatibilityJSON: "v4",
  interpolation: {
    escapeValue: false,
  },
});

// to change the language on demand use => i18n.changeLanguage(language);

export default i18n;
