import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "config/constants";
import { isValidPasswordLength } from "helpers/passwordValidation";

describe("isValidPasswordLength", () => {
  it.each([
    { label: "an empty password", length: 0, expected: false },
    {
      label: "a password one short of the minimum",
      length: PASSWORD_MIN_LENGTH - 1,
      expected: false,
    },
    {
      label: "a password at the minimum",
      length: PASSWORD_MIN_LENGTH,
      expected: true,
    },
    {
      label: "a password at the maximum",
      length: PASSWORD_MAX_LENGTH,
      expected: true,
    },
    {
      label: "a password one over the maximum",
      length: PASSWORD_MAX_LENGTH + 1,
      expected: false,
    },
  ])("returns $expected for $label", ({ length, expected }) => {
    expect(isValidPasswordLength("x".repeat(length))).toBe(expected);
  });
});
