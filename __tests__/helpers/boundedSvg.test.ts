import { fetchBoundedSvg, isRenderableSvg } from "helpers/boundedSvg";

const SIMPLE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><path d='M0 0h1v1z'/></svg>";

describe("isRenderableSvg", () => {
  it("accepts a plain icon", () => {
    expect(isRenderableSvg(SIMPLE_SVG)).toBe(true);
  });

  it("accepts gradients, clip paths, masks and text", () => {
    expect(
      isRenderableSvg(
        "<svg><defs><linearGradient id='g'><stop offset='0'/></linearGradient><clipPath id='c'><rect/></clipPath><mask id='m'><circle/></mask></defs><g><text><tspan>A</tspan></text></g></svg>",
      ),
    ).toBe(true);
  });

  it.each(["use", "image", "pattern", "filter", "foreignObject", "script"])(
    "rejects an SVG with a <%s> element",
    (element) => {
      expect(isRenderableSvg(`<svg><${element}/></svg>`)).toBe(false);
    },
  );

  it("rejects a DOCTYPE or entity declaration", () => {
    expect(isRenderableSvg(`<!DOCTYPE svg>${SIMPLE_SVG}`)).toBe(false);
    expect(isRenderableSvg(`<!ENTITY a "b">${SIMPLE_SVG}`)).toBe(false);
  });

  it("accepts 2000 elements and rejects 2001", () => {
    expect(isRenderableSvg(`<svg>${"<path/>".repeat(1999)}</svg>`)).toBe(true);
    expect(isRenderableSvg(`<svg>${"<path/>".repeat(2000)}</svg>`)).toBe(false);
  });

  it("rejects text longer than 102400 characters", () => {
    const padded = (length: number) =>
      `<svg><title>${"a".repeat(length - 26)}</title></svg>`;

    expect(padded(102400)).toHaveLength(102400);
    expect(isRenderableSvg(padded(102400))).toBe(true);
    expect(isRenderableSvg(padded(102401))).toBe(false);
  });
});

/** A stand-in XMLHttpRequest whose events each test fires by hand. */
class FakeXhr {
  static last: FakeXhr | undefined;

  method = "";

  url = "";

  responseType = "";

  timeout = 0;

  status = 0;

  responseText = "";

  aborted = false;

  sent = false;

  onprogress: ((event: { loaded: number }) => void) | null = null;

  onload: (() => void) | null = null;

  onerror: (() => void) | null = null;

  ontimeout: (() => void) | null = null;

  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send() {
    this.sent = true;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe("fetchBoundedSvg", () => {
  const realXhr = global.XMLHttpRequest;

  beforeEach(() => {
    FakeXhr.last = undefined;
    global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    global.XMLHttpRequest = realXhr;
  });

  const request = () => {
    if (!FakeXhr.last) {
      throw new Error("No request was opened");
    }
    return FakeXhr.last;
  };

  it("resolves the text of a small SVG served with 200", async () => {
    const result = fetchBoundedSvg("https://dapp.example/icon.svg");
    expect(request().url).toBe("https://dapp.example/icon.svg");
    expect(request().timeout).toBe(5000);
    expect(request().sent).toBe(true);

    request().status = 200;
    request().responseText = SIMPLE_SVG;
    request().onload?.();

    await expect(result).resolves.toBe(SIMPLE_SVG);
  });

  it("resolves null without a request for a non-https URL", async () => {
    await expect(fetchBoundedSvg("http://dapp.example/icon.svg")).resolves.toBe(
      null,
    );
    expect(FakeXhr.last).toBeUndefined();
  });

  it("aborts once the download passes 102400 bytes", async () => {
    const result = fetchBoundedSvg("https://dapp.example/icon.svg");

    request().onprogress?.({ loaded: 102400 });
    expect(request().aborted).toBe(false);
    request().onprogress?.({ loaded: 102401 });

    expect(request().aborted).toBe(true);
    await expect(result).resolves.toBe(null);
  });

  it.each([0, -1])(
    "aborts once the text received passes 102400 characters, even when progress reports %p bytes loaded as React Native does on Android",
    async (loaded) => {
      const result = fetchBoundedSvg("https://dapp.example/icon.svg");

      request().responseText = "a".repeat(102400);
      request().onprogress?.({ loaded });
      expect(request().aborted).toBe(false);

      request().responseText = "a".repeat(102401);
      request().onprogress?.({ loaded });

      expect(request().aborted).toBe(true);
      await expect(result).resolves.toBe(null);
    },
  );

  it("resolves null on a timeout, an error or a non-200 status", async () => {
    const timedOut = fetchBoundedSvg("https://dapp.example/a.svg");
    request().ontimeout?.();
    await expect(timedOut).resolves.toBe(null);

    const failed = fetchBoundedSvg("https://dapp.example/b.svg");
    request().onerror?.();
    await expect(failed).resolves.toBe(null);

    const missing = fetchBoundedSvg("https://dapp.example/c.svg");
    request().status = 404;
    request().responseText = SIMPLE_SVG;
    request().onload?.();
    await expect(missing).resolves.toBe(null);
  });

  it("resolves null for an SVG that isn't a plain icon", async () => {
    const result = fetchBoundedSvg("https://dapp.example/icon.svg");
    request().status = 200;
    request().responseText = "<svg><use href='#a'/></svg>";
    request().onload?.();

    await expect(result).resolves.toBe(null);
  });
});
