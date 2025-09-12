import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useManageToken } from "hooks/useManageToken";
import { analytics } from "services/analytics";

jest.mock("services/analytics", () => ({
  analytics: {
    trackAddTokenConfirmed: jest.fn(),
    trackRemoveTokenConfirmed: jest.fn(),
  },
}));

const mockAddToken = jest.fn();
const mockRemoveToken = jest.fn();
jest.mock("hooks/useManageTokens", () => ({
  useManageTokens: jest.fn(() => ({
    addToken: mockAddToken,
    removeToken: mockRemoveToken,
    isAddingToken: false,
    isRemovingToken: false,
  })),
}));

describe("useManageToken", () => {
  const mockCode = "USDC";
  const mockIssuer = "GCKUVXILBNYS4FDNWCGCYSJBY2PBQ4KAW2M5CODRVJPUFM62IJFH67J2";
  const mockName = "USDC Coin";
  const mockDecimals = 7;
  const mockId = `${mockCode}:${mockIssuer}`;
  const mockToken = {
    id: mockId,
    code: mockCode,
    decimals: mockDecimals,
    name: mockName,
    issuer: mockIssuer,
    type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  };

  const mockBottomSheetAdd: React.RefObject<BottomSheetModal> = {
    current: {
      dismiss: jest.fn(),
    } as unknown as BottomSheetModal,
  };

  const mockBottomSheetRemove: React.RefObject<BottomSheetModal> = {
    current: {
      dismiss: jest.fn(),
    } as unknown as BottomSheetModal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call addToken and dismiss bottom sheet", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefAdd: mockBottomSheetAdd,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.addToken();
    });

    expect(analytics.trackAddTokenConfirmed).toHaveBeenCalledWith("USDC");
    expect(mockAddToken).toHaveBeenCalledWith({
      tokenCode: mockCode,
      decimals: mockDecimals,
      issuer: mockIssuer,
      name: mockName,
    });
    expect(mockBottomSheetAdd.current.dismiss).toHaveBeenCalled();
  });

  it("should call removeToken and dismiss bottom sheet", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        bottomSheetRefRemove: mockBottomSheetRemove,
        token: mockToken,
      }),
    );

    await act(async () => {
      await result.current.removeToken();
    });

    expect(analytics.trackRemoveTokenConfirmed).toHaveBeenCalledWith("USDC");
    expect(mockRemoveToken).toHaveBeenCalledWith({
      tokenId: mockId,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });
    expect(mockBottomSheetRemove.current.dismiss).toHaveBeenCalled();
  });

  it("should not call actions if token is null", async () => {
    const { result } = renderHook(() =>
      useManageToken({
        account: null,
        network: NETWORKS.TESTNET,
        token: null,
      }),
    );

    await act(async () => {
      await result.current.addToken();
      await result.current.removeToken();
    });

    expect(mockAddToken).not.toHaveBeenCalled();
    expect(mockRemoveToken).not.toHaveBeenCalled();
  });
});
