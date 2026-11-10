import { MAX_METADATA_BYTES } from "helpers/fetchMetadataJson";
import {
  isMetadataDataUri,
  parseMetadataDataUri,
} from "helpers/parseMetadataDataUri";

const metadata = {
  name: "Stroopies 0",
  image:
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='rgb(47,47,50)'/></svg>",
  attributes: [
    { trait_type: "role", value: 3 },
    { trait_type: "arms", value: 0 },
  ],
};

const toBase64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

describe("isMetadataDataUri", () => {
  it("matches data URIs regardless of scheme casing", () => {
    expect(isMetadataDataUri("data:application/json,{}")).toBe(true);
    expect(isMetadataDataUri("DATA:application/json,{}")).toBe(true);
  });

  it("does not match remote or empty URIs", () => {
    expect(isMetadataDataUri("https://example.com/metadata.json")).toBe(false);
    expect(isMetadataDataUri("ipfs://bafy")).toBe(false);
    expect(isMetadataDataUri("")).toBe(false);
  });
});

describe("parseMetadataDataUri", () => {
  it("parses a raw (unencoded) JSON payload with an inline SVG image", () => {
    const uri = `data:application/json,${JSON.stringify(metadata)}`;

    expect(parseMetadataDataUri(uri)).toEqual(metadata);
  });

  it("parses a percent-encoded JSON payload", () => {
    const uri = `data:application/json,${encodeURIComponent(
      JSON.stringify(metadata),
    )}`;

    expect(parseMetadataDataUri(uri)).toEqual(metadata);
  });

  it("parses a base64 JSON payload", () => {
    const uri = `data:application/json;base64,${toBase64(
      JSON.stringify(metadata),
    )}`;

    expect(parseMetadataDataUri(uri)).toEqual(metadata);
  });

  it("rejects anything that is not a data:application/json URI", () => {
    [
      "https://example.com/metadata.json",
      "data:text/html,<p>hi</p>",
      `data:,${JSON.stringify({ name: "x" })}`,
      "data:application/json",
    ].forEach((uri) => {
      expect(() => parseMetadataDataUri(uri)).toThrow(
        "not a data:application/json URI",
      );
    });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseMetadataDataUri("data:application/json,{nope")).toThrow();
  });

  it("rejects malformed base64", () => {
    expect(() =>
      parseMetadataDataUri("data:application/json;base64,***"),
    ).toThrow();
  });

  it("rejects JSON that is not an object", () => {
    expect(() => parseMetadataDataUri("data:application/json,[1,2]")).toThrow(
      "not a JSON object",
    );
    expect(() => parseMetadataDataUri("data:application/json,null")).toThrow(
      "not a JSON object",
    );
    expect(() =>
      parseMetadataDataUri(`data:application/json,${JSON.stringify("text")}`),
    ).toThrow("not a JSON object");
  });

  it("rejects a URI larger than MAX_METADATA_BYTES", () => {
    const uri = `data:application/json,${JSON.stringify({
      name: "x".repeat(MAX_METADATA_BYTES),
    })}`;

    expect(() => parseMetadataDataUri(uri)).toThrow("uri too large");
  });
});
