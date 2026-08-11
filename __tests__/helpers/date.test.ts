import {
  formatClockTime,
  formatDetailTimestamp,
  formatMonthDay,
  formatMonthDayYear,
  formatMonthLabel,
  getMonthYearKey,
} from "helpers/date";
import { getDeviceLanguage } from "helpers/localeUtils";

/**
 * The formatters render in local time and jest does not pin `TZ`, so build the
 * fixtures from local-time components: whatever zone the suite runs in, this
 * instant is 2:33 PM on Apr 8 2024 locally.
 */
const localIso = (
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
) => new Date(year, monthIndex, day, hour, minute).toISOString();

const TIMESTAMP = localIso(2024, 3, 8, 14, 33);

describe("date formatters", () => {
  it("formats a row date as 'MMM D' with no zero padding", () => {
    expect(formatMonthDay(TIMESTAMP)).toBe("Apr 8");
    expect(formatMonthDay(localIso(2024, 4, 27, 12, 0))).toBe("May 27");
  });

  it("formats a date with the year", () => {
    expect(formatMonthDayYear(TIMESTAMP)).toBe("Apr 8, 2024");
  });

  it("formats a 12-hour clock time", () => {
    expect(formatClockTime(TIMESTAMP)).toBe("2:33 PM");
    expect(formatClockTime(localIso(2024, 3, 8, 0, 5))).toBe("12:05 AM");
  });

  it("formats the detail sheet timestamp", () => {
    expect(formatDetailTimestamp(TIMESTAMP)).toBe("Apr 8, 2024 · 2:33pm");
  });

  it("labels a month index, January being 0", () => {
    expect(formatMonthLabel(0)).toBe("January");
    expect(formatMonthLabel(11)).toBe("December");
  });

  it("labels nothing for a month index that isn't one", () => {
    expect(formatMonthLabel(NaN)).toBe("");
    expect(formatMonthLabel(12)).toBe("");
    expect(formatMonthLabel(-1)).toBe("");
  });

  it("keys a timestamp by month and year", () => {
    expect(getMonthYearKey(TIMESTAMP)).toBe("3:2024");
  });

  it("keys an unparseable timestamp so it renders no month header", () => {
    const key = getMonthYearKey("not a date");
    expect(key).toBe("NaN:NaN");
    // how the views derive the header — must not resolve to a real month
    expect(formatMonthLabel(Number(key.split(":")[0]))).toBe("");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    // Ported verbatim from the extension's date.test.ts.
    // eslint-disable-next-line no-restricted-syntax -- for...of over these four formatters reads clearer than an array-iteration rewrite here.
    for (const format of [
      formatMonthDay,
      formatMonthDayYear,
      formatClockTime,
      formatDetailTimestamp,
    ]) {
      expect(format("not a date")).toBe("");
      expect(format("")).toBe("");
    }
  });

  it("defaults every formatter's locale to the device language", () => {
    // Spies on every Date.prototype locale method and records the actual
    // locale argument each one receives, rather than hard-coding an expected
    // language: this app ships en and pt, and the CI device locale isn't
    // this test's concern. `getDeviceLanguage()` is the same source of truth
    // the formatters themselves fall back to, so reading it here — instead
    // of assuming it returns "en" — keeps the assertion honest regardless of
    // what the CI device locale actually is.
    const deviceLanguage = getDeviceLanguage();
    const seen: unknown[] = [];
    const spies = (
      ["toLocaleDateString", "toLocaleTimeString", "toLocaleString"] as const
    ).map((method) =>
      jest.spyOn(Date.prototype, method).mockImplementation((...args) => {
        seen.push(args[0]);
        return "stub";
      }),
    );

    formatMonthDay(TIMESTAMP);
    formatMonthDayYear(TIMESTAMP);
    formatClockTime(TIMESTAMP);
    formatDetailTimestamp(TIMESTAMP);
    formatMonthLabel(3);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((locale) => locale === deviceLanguage)).toBe(true);

    spies.forEach((spy) => spy.mockRestore());
  });

  it("lets each formatter override the default locale explicitly", () => {
    // An override distinct from any plausible device-language default
    // (which is always a bare "en"/"pt"-style tag from getDeviceLanguage())
    // proves the passed-in locale — not the device default — reaches the
    // underlying Date method.
    const OVERRIDE_LOCALE = "fr-FR";
    const seen: unknown[] = [];
    const spies = (
      ["toLocaleDateString", "toLocaleTimeString", "toLocaleString"] as const
    ).map((method) =>
      jest.spyOn(Date.prototype, method).mockImplementation((...args) => {
        seen.push(args[0]);
        return "stub";
      }),
    );

    formatMonthDay(TIMESTAMP, OVERRIDE_LOCALE);
    formatMonthDayYear(TIMESTAMP, OVERRIDE_LOCALE);
    formatClockTime(TIMESTAMP, OVERRIDE_LOCALE);
    formatDetailTimestamp(TIMESTAMP, OVERRIDE_LOCALE);
    formatMonthLabel(3, OVERRIDE_LOCALE);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((locale) => locale === OVERRIDE_LOCALE)).toBe(true);

    spies.forEach((spy) => spy.mockRestore());
  });
});
