import en from "i18n/locales/en/translations.json";
import pt from "i18n/locales/pt/translations.json";

// The pill draws no text, so screen readers announce the History tab by its
// label. It names the tab as the screen's own bar does: "Activity".
describe("the History tab's label", () => {
  it.each([
    ["en", en, "Activity"],
    ["pt", pt, "Atividade"],
  ] as const)("matches the screen's title in %s", (_, strings, title) => {
    expect(strings.history.title).toBe(title);
    expect(strings.tabBar.history).toBe(title);
  });
});
