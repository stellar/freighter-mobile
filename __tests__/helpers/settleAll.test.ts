import { settleAll } from "helpers/settleAll";

/** A promise the test settles. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe("settleAll", () => {
  it("returns the values in order", async () => {
    await expect(
      settleAll([Promise.resolve(1), Promise.resolve("two")]),
    ).resolves.toEqual([1, "two"]);
  });

  // The point of it: a write still running when another fails must finish
  // before the caller can roll back.
  it("waits for a slower promise before throwing an earlier rejection", async () => {
    const slow = deferred<string>();
    const failure = new Error("first");
    let settled = false;

    const result = settleAll([Promise.reject(failure), slow.promise]).catch(
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    slow.resolve("done");

    await expect(result).resolves.toBe(failure);
  });

  it("throws the first rejection in input order", async () => {
    const later = deferred<never>();
    const first = new Error("first");
    const second = new Error("second");

    const result = settleAll([later.promise, Promise.reject(second)]);
    later.reject(first);

    await expect(result).rejects.toBe(first);
  });
});
