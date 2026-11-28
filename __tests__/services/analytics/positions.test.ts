import { AnalyticsEvent } from "config/analyticsConfig";
import {
  trackEarnPoolDetailsTabSelected,
  trackPositionsActivityDetailsAction,
  trackPositionsActivityRowSelected,
  trackPositionsEmptyCtaSelected,
  trackPositionsPoolSelected,
  trackPositionsRowSelected,
} from "services/analytics/positions";

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");

const POOL_ID = "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";

// The payloads are the extension's, property for property, so both
// platforms land in one funnel.
describe("Positions events", () => {
  beforeEach(() => {
    track.mockClear();
  });

  it("names every event as the extension does", () => {
    expect({
      poolSelected: AnalyticsEvent.POSITIONS_POOL_SELECTED,
      rowSelected: AnalyticsEvent.POSITIONS_ROW_SELECTED,
      emptyCtaSelected: AnalyticsEvent.POSITIONS_EMPTY_CTA_SELECTED,
      activityRowSelected: AnalyticsEvent.POSITIONS_ACTIVITY_ROW_SELECTED,
      activityDetailsAction:
        AnalyticsEvent.POSITIONS_ACTIVITY_DETAILS_ACTION_SELECTED,
      poolDetailsTabSelected: AnalyticsEvent.EARN_POOL_DETAILS_TAB_SELECTED,
    }).toEqual({
      poolSelected: "positions.pool_selected",
      rowSelected: "positions.row_selected",
      emptyCtaSelected: "positions.empty_cta_selected",
      activityRowSelected: "positions.activity_row_selected",
      activityDetailsAction: "positions.activity_details_action_selected",
      poolDetailsTabSelected: "earn.pool_details_tab_selected",
    });
  });

  it("positions.pool_selected", () => {
    trackPositionsPoolSelected({ poolId: POOL_ID, protocol: "blend" });
    expect(track).toHaveBeenCalledWith("positions.pool_selected", {
      pool_id: POOL_ID,
      protocol: "blend",
    });
  });

  it("positions.row_selected", () => {
    trackPositionsRowSelected({
      poolId: POOL_ID,
      protocol: "blend",
      assetCode: "USDC",
    });
    expect(track).toHaveBeenCalledWith("positions.row_selected", {
      pool_id: POOL_ID,
      protocol: "blend",
      asset_code: "USDC",
    });
  });

  it("positions.empty_cta_selected, with no properties", () => {
    trackPositionsEmptyCtaSelected();
    expect(track).toHaveBeenCalledWith("positions.empty_cta_selected");
  });

  it("positions.activity_row_selected", () => {
    trackPositionsActivityRowSelected({
      poolId: POOL_ID,
      protocol: "blend",
      assetCode: "USDC",
      activityType: "withdraw",
    });
    expect(track).toHaveBeenCalledWith("positions.activity_row_selected", {
      pool_id: POOL_ID,
      protocol: "blend",
      asset_code: "USDC",
      activity_type: "withdraw",
    });
  });

  it("positions.activity_details_action_selected", () => {
    trackPositionsActivityDetailsAction({
      poolId: POOL_ID,
      protocol: "blend",
      assetCode: "USDC",
      activityType: "deposit",
      action: "explorer",
    });
    expect(track).toHaveBeenCalledWith(
      "positions.activity_details_action_selected",
      {
        pool_id: POOL_ID,
        protocol: "blend",
        asset_code: "USDC",
        activity_type: "deposit",
        action: "explorer",
      },
    );
  });

  it("earn.pool_details_tab_selected, from a position row", () => {
    trackEarnPoolDetailsTabSelected({ poolId: POOL_ID, tab: "overview" });
    expect(track).toHaveBeenCalledWith("earn.pool_details_tab_selected", {
      protocol: "blend",
      pool_id: POOL_ID,
      tab: "overview",
      source: "position_row",
    });
  });
});
