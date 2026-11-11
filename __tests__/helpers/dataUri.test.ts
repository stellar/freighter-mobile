import { decodeDataUri } from "helpers/dataUri";

const svg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='rgb(47,47,50)'/></svg>";

const toBase64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

describe("decodeDataUri", () => {
  it("decodes a raw (unencoded) payload", () => {
    expect(decodeDataUri(`data:image/svg+xml,${svg}`, "image/svg+xml")).toBe(
      svg,
    );
  });

  it("decodes a percent-encoded payload", () => {
    expect(
      decodeDataUri(
        `data:image/svg+xml,${encodeURIComponent(svg)}`,
        "image/svg+xml",
      ),
    ).toBe(svg);
  });

  it("decodes a base64 payload, including non-ASCII text", () => {
    const text = JSON.stringify({ name: "Café ☕" });

    expect(
      decodeDataUri(
        `data:application/json;base64,${toBase64(text)}`,
        "application/json",
      ),
    ).toBe(text);
  });

  it("decodes a base64 payload whose characters are percent-encoded", () => {
    const encoded = encodeURIComponent(toBase64(svg));
    expect(encoded).toContain("%2B");

    expect(
      decodeDataUri(`data:image/svg+xml;base64,${encoded}`, "image/svg+xml"),
    ).toBe(svg);
  });

  it("returns a text payload as written when percentDecode is false", () => {
    const encoded = encodeURIComponent(svg);

    expect(
      decodeDataUri(`data:image/svg+xml,${encoded}`, "image/svg+xml", {
        percentDecode: false,
      }),
    ).toBe(encoded);
  });

  it("accepts media type parameters and mixed casing", () => {
    expect(
      decodeDataUri(
        `DATA:Image/SVG+XML;charset=utf-8;base64,${toBase64(svg)}`,
        "image/svg+xml",
      ),
    ).toBe(svg);
  });

  it("keeps commas that are part of the payload", () => {
    const json = JSON.stringify({ a: 1, b: 2 });

    expect(
      decodeDataUri(`data:application/json,${json}`, "application/json"),
    ).toBe(json);
  });

  it("falls back to the raw payload when it is not valid percent-encoding", () => {
    const raw = "<svg width='100%' height='100%'/>";

    expect(decodeDataUri(`data:image/svg+xml,${raw}`, "image/svg+xml")).toBe(
      raw,
    );
  });

  it("returns null for anything that is not a data URI of that media type", () => {
    [
      "https://example.com/image.svg",
      "data:image/png;base64,iVBORw0KGgo=",
      `data:,${svg}`,
      "data:image/svg+xml",
      "",
    ].forEach((uri) => {
      expect(decodeDataUri(uri, "image/svg+xml")).toBeNull();
    });
  });
});
