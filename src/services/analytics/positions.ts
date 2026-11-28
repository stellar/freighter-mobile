import { AnalyticsEvent } from "config/analyticsConfig";
import { track } from "services/analytics/core";
import { trackEarn } from "services/analytics/earn";

/**
 * Home's Positions tab, with the extension's event names and properties.
 * `positions.*` events carry the position's protocol themselves; the
 * `earn.*` ones get it from `trackEarn`.
 */

interface PositionProps {
  poolId: string;
  protocol: string;
}

/** A pool card was tapped. */
export const trackPositionsPoolSelected = ({
  poolId,
  protocol,
}: PositionProps): void => {
  track(AnalyticsEvent.POSITIONS_POOL_SELECTED, { pool_id: poolId, protocol });
};

/** A token was tapped on a pool's position screen. */
export const trackPositionsRowSelected = ({
  poolId,
  protocol,
  assetCode,
}: PositionProps & { assetCode: string }): void => {
  track(AnalyticsEvent.POSITIONS_ROW_SELECTED, {
    pool_id: poolId,
    protocol,
    asset_code: assetCode,
  });
};

/** "Start Earning" was tapped on the empty tab. */
export const trackPositionsEmptyCtaSelected = (): void => {
  track(AnalyticsEvent.POSITIONS_EMPTY_CTA_SELECTED);
};

export type PositionActivityKind = "deposit" | "withdraw";

/** A deposit or withdrawal row in a token's Activity was tapped. */
export const trackPositionsActivityRowSelected = ({
  poolId,
  protocol,
  assetCode,
  activityType,
}: PositionProps & {
  assetCode: string;
  activityType: PositionActivityKind;
}): void => {
  track(AnalyticsEvent.POSITIONS_ACTIVITY_ROW_SELECTED, {
    pool_id: poolId,
    protocol,
    asset_code: assetCode,
    activity_type: activityType,
  });
};

/** "Transaction details" or the explorer link in an Activity row's sheet. */
export const trackPositionsActivityDetailsAction = ({
  poolId,
  protocol,
  assetCode,
  activityType,
  action,
}: PositionProps & {
  assetCode: string;
  activityType: PositionActivityKind;
  action: "transaction_details" | "explorer";
}): void => {
  track(AnalyticsEvent.POSITIONS_ACTIVITY_DETAILS_ACTION_SELECTED, {
    pool_id: poolId,
    protocol,
    asset_code: assetCode,
    activity_type: activityType,
    action,
  });
};

/** A token position's tab changed; never sent for the tab it opens on. */
export const trackEarnPoolDetailsTabSelected = ({
  poolId,
  tab,
}: {
  poolId: string;
  tab: "your_position" | "overview";
}): void => {
  trackEarn(AnalyticsEvent.EARN_POOL_DETAILS_TAB_SELECTED, {
    pool_id: poolId,
    tab,
    source: "position_row",
  });
};
