import { isHorizonNotFoundError } from "helpers/horizonErrors";

describe("isHorizonNotFoundError", () => {
  it("is true for a 404 response", () => {
    expect(isHorizonNotFoundError({ response: { status: 404 } })).toBe(true);
  });

  it.each([
    ["a 429", { response: { status: 429 } }],
    ["a 500", { response: { status: 500 } }],
    ["a response without a status", { response: {} }],
    ["an error without a response", new Error("Network Error")],
    ["null", null],
    ["a string", "404"],
  ])("is false for %s", (_, error) => {
    expect(isHorizonNotFoundError(error)).toBe(false);
  });
});
