import {
  NoticeBannerVariants,
  type NoticeBannerVariant,
} from "components/sds/NoticeBanner";
import { getDeviceLanguage } from "helpers/localeUtils";

type LocalizedString = {
  [lang: string]: string | undefined;
};

type LocalizedStringArray = {
  [lang: string]: string[] | undefined;
};

const VALID_VARIANTS = Object.values(NoticeBannerVariants);

const toVariant = (value: unknown): NoticeBannerVariant =>
  VALID_VARIANTS.includes(value as NoticeBannerVariant)
    ? (value as NoticeBannerVariant)
    : NoticeBannerVariants.WARNING;

export type MaintenanceBannerContent = {
  title: string;
  theme: NoticeBannerVariant;
  url?: string;
  modal?: {
    title: string;
    body: string[];
  };
};

export type MaintenanceScreenContent = {
  title: string;
  body: string[];
};

const getLocalizedString = (
  obj: LocalizedString | undefined,
  fallback: string,
): string => {
  if (!obj) return fallback;
  const lang = getDeviceLanguage();
  const value = obj[lang] ?? obj.en;
  return typeof value === "string" ? value : fallback;
};

const getLocalizedStringArray = (
  obj: LocalizedStringArray | undefined,
  fallback: string[],
): string[] => {
  if (!obj) return fallback;
  const lang = getDeviceLanguage();
  const value = obj[lang] ?? obj.en;
  if (!Array.isArray(value)) return fallback;
  return value.filter((v): v is string => typeof v === "string");
};

/**
 * Parses the maintenance_banner Amplitude flag payload into localized content.
 * Payload shape:
 *   { theme, url?, banner: { title: { en, pt } }, modal?: { title: { en, pt }, body: { en: [], pt: [] } } }
 */
export const maintenanceBannerContent = (flag: {
  enabled: boolean;
  payload: Record<string, unknown> | undefined;
}): MaintenanceBannerContent => {
  const { payload } = flag;
  const banner = payload?.banner as
    | {
        title?: LocalizedString;
      }
    | undefined;

  const modalPayload = payload?.modal as
    | {
        title?: LocalizedString;
        body?: LocalizedStringArray;
      }
    | undefined;

  const url =
    typeof payload?.url === "string" && payload.url ? payload.url : undefined;

  const theme = toVariant(payload?.theme);

  const title = getLocalizedString(banner?.title, "");

  const modal = modalPayload
    ? {
        title: getLocalizedString(modalPayload.title, title),
        body: getLocalizedStringArray(modalPayload.body, []),
      }
    : undefined;

  return { title, theme, url, modal };
};

/**
 * Parses the maintenance_screen Amplitude flag payload into localized content.
 * Payload shape:
 *   { content: { title: { en, pt }, body: { en: [], pt: [] } } }
 */
export const maintenanceScreenContent = (flag: {
  enabled: boolean;
  payload: Record<string, unknown> | undefined;
}): MaintenanceScreenContent => {
  const { payload } = flag;
  const content = payload?.content as
    | {
        title?: LocalizedString;
        body?: LocalizedStringArray;
      }
    | undefined;

  const title = getLocalizedString(content?.title, "");
  const body = getLocalizedStringArray(content?.body, []);

  return { title, body };
};
