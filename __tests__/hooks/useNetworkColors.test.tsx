import { renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import useColors, { ThemeColors } from "hooks/useColors";
import useNetworkColors from "hooks/useNetworkColors";

jest.mock("hooks/useColors");

const mockPartialThemeColors: Partial<ThemeColors> = {
  pink: { "9": "mockPink9" } as ThemeColors["pink"],
  lime: { "9": "mockLime9" } as ThemeColors["lime"],
  mint: { "9": "mockMint9" } as ThemeColors["mint"],
};

const mockUseColors = useColors as jest.MockedFunction<typeof useColors>;

describe("useNetworkColors", () => {
  it("should return the correct colors for each network", () => {
    mockUseColors.mockReturnValue({
      themeColors: mockPartialThemeColors as ThemeColors,
    });

    const { result } = renderHook(() => useNetworkColors());

    expect(result.current[NETWORKS.TESTNET]).toBe(
      mockPartialThemeColors.pink?.[9],
    );
    expect(result.current[NETWORKS.PUBLIC]).toBe(
      mockPartialThemeColors.lime?.[9],
    );
    expect(result.current[NETWORKS.FUTURENET]).toBe(
      mockPartialThemeColors.mint?.[9],
    );
  });
});
