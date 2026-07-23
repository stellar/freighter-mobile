import { getAuthKeypair } from "services/auth/getAuthKeypair";
import { getAuthUserId } from "services/auth/getAuthUserId";

// Mock only the immediate dependency: getAuthKeypair does its own thorough
// derivation/caching/session-gate testing in getAuthKeypair.test.ts.
jest.mock("services/auth/getAuthKeypair", () => ({
  getAuthKeypair: jest.fn(),
}));

const mockGetAuthKeypair = getAuthKeypair as jest.Mock;

describe("getAuthUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the public hex when a keypair is available", async () => {
    mockGetAuthKeypair.mockResolvedValue({
      rawPublicKey: () => Buffer.from("ff", "hex"),
    });
    expect(await getAuthUserId()).toBe("ff");
  });

  it("returns null when the session has no keypair", async () => {
    mockGetAuthKeypair.mockResolvedValue(null);
    expect(await getAuthUserId()).toBeNull();
  });
});
