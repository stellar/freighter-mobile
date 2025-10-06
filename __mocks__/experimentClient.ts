/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Variant } from "@amplitude/experiment-react-native-client";
import { Experiment } from "@amplitude/experiment-react-native-client";

/**
 * Mock experiment client helpers for Amplitude Experiments
 */

type ExperimentClient = ReturnType<
  typeof Experiment.initializeWithAmplitudeAnalytics
>;

/**
 * Mock type that combines ExperimentClient with jest mock functions
 */
export type MockExperimentClient = {
  fetch: jest.MockedFunction<ExperimentClient["fetch"]>;
  variant: jest.MockedFunction<ExperimentClient["variant"]>;
  all: jest.MockedFunction<ExperimentClient["all"]>;
  clear: jest.MockedFunction<ExperimentClient["clear"]>;
  exposure: jest.MockedFunction<ExperimentClient["exposure"]>;
} & ExperimentClient;

/**
 * Creates a mock experiment client for testing with proper typing
 * Returns a partial mock that can be used where ExperimentClient is expected
 */
export const createMockExperimentClient = (): MockExperimentClient =>
  ({
    fetch: jest.fn().mockResolvedValue(undefined as any),
    variant: jest.fn().mockReturnValue({ value: undefined } as Variant),
    all: jest.fn().mockReturnValue({}),
    clear: jest.fn(),
    exposure: jest.fn(),
  }) as unknown as MockExperimentClient;

/**
 * Creates a mock experiment client with predefined variant responses
 *
 * @example
 * const mockClient = createMockExperimentClientWithVariants({
 *   swap_enabled: { value: "on" },
 *   discover_enabled: { value: "off" },
 * });
 */
export const createMockExperimentClientWithVariants = (
  variants: Record<string, Variant>,
) => {
  const mockClient = createMockExperimentClient();
  mockClient.variant.mockImplementation(
    (flag: string) => variants[flag] || { value: undefined },
  );
  return mockClient;
};
