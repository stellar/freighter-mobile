import { withAccountMutationLock } from "helpers/accountMutationLock";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe("withAccountMutationLock", () => {
  it("runs a second holder only after the first settles", async () => {
    const first = deferred();
    const events: string[] = [];

    const a = withAccountMutationLock(async () => {
      events.push("a:start");
      await first.promise;
      events.push("a:end");
      return "a";
    });
    const b = withAccountMutationLock(() => {
      events.push("b:start");
      return Promise.resolve("b");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["a:start"]);

    first.resolve();

    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
    expect(events).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("releases the lock when a holder rejects, and passes the rejection on", async () => {
    const failing = withAccountMutationLock(() =>
      Promise.reject(new Error("boom")),
    );
    const next = withAccountMutationLock(() => Promise.resolve("next"));

    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("next");
  });
});
