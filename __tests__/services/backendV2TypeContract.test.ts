import { freighterBackendV2 } from "services/backend";

// Mock the real module so no network calls happen; the value of this file is
// the compile-time checks enforced by tsc, not the runtime behaviour.
jest.mock("services/apiFactory", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      setAuthToken: jest.fn(),
      getInstance: jest.fn(() => ({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: { headers: { common: {} } },
      })),
    })),
  };
});

jest.mock("services/auth/attachAuth", () => ({
  attachAuthInterceptors: jest.fn(),
}));

jest.mock("config/envConfig", () => ({
  BackendEnvConfig: {
    FREIGHTER_BACKEND_V1_URL: "https://v1.example.com",
    FREIGHTER_BACKEND_V2_URL: "https://v2.example.com",
  },
}));

describe("freighterBackendV2 body-type contract", () => {
  it("accepts a string body (compiles)", () => {
    // Runtime no-op; this file's value is the compile-time checks below.
    expect(typeof freighterBackendV2.post).toBe("function");
  });

  it("rejects a non-string (object) body at compile time", () => {
    // @ts-expect-error - object bodies are forbidden; bodies must be pre-serialized strings
    const badCall = () => freighterBackendV2.post("/x", { obj: 1 });
    // A string body must NOT error:
    const goodCall = () =>
      freighterBackendV2.post("/x", JSON.stringify({ obj: 1 }));
    // Reference to silence unused-variable lint; the value of this block is
    // the compile-time assertions above, not the runtime result.
    expect(typeof badCall).toBe("function");
    expect(typeof goodCall).toBe("function");
  });
});
