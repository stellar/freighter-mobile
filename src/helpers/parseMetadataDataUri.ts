import { decodeDataUri } from "helpers/dataUri";
import { MAX_METADATA_BYTES } from "helpers/fetchMetadataJson";

/**
 * Whether a token URI carries its metadata inline as a `data:` URI rather
 * than pointing at a remote document.
 */
export const isMetadataDataUri = (uri: string) => /^data:/i.test(uri);

/**
 * Parses a JSON metadata document embedded in a `data:` URI, e.g.
 * `data:application/json,{"name":"..."}` or
 * `data:application/json;base64,eyJuYW1lIjoi...`.
 *
 * The inline counterpart of fetchMetadataJson: no network call is made, only
 * the `application/json` media type is accepted, the URI is capped at
 * MAX_METADATA_BYTES, and the document must be a JSON object. Throws on any
 * violation so callers can treat it like a failed fetch.
 */
export const parseMetadataDataUri = <T>(uri: string): T => {
  if (uri.length > MAX_METADATA_BYTES) {
    throw new Error(
      `parseMetadataDataUri: uri too large (max ${MAX_METADATA_BYTES} bytes)`,
    );
  }

  const text = decodeDataUri(uri, "application/json");
  if (text === null) {
    throw new Error(
      "parseMetadataDataUri: uri is not a data:application/json URI",
    );
  }

  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("parseMetadataDataUri: document is not a JSON object");
  }

  return parsed as T;
};
