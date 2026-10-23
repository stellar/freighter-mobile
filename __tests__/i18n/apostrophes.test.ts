import en from "i18n/locales/en/translations.json";
import pt from "i18n/locales/pt/translations.json";

const stringsIn = (node: unknown, path = ""): [string, string][] => {
  if (typeof node === "string") return [[path, node]];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      stringsIn(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
};

describe.each([
  ["en", en],
  ["pt", pt],
])("%s translations", (_locale, strings) => {
  it("use the straight apostrophe, the one most strings already use", () => {
    const curly = stringsIn(strings)
      .filter(([, value]) => /[‘’]/.test(value))
      .map(([path]) => path);

    expect(curly).toEqual([]);
  });
});
