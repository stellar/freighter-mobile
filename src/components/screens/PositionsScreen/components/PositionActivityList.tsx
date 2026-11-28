import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { TokenIcon } from "components/TokenIcon";
import { BlendPoolIcon } from "components/screens/EarnScreen/components/BlendPoolIcon";
import {
  EarnDepositDetailsBottomSheet,
  EarnDetailsAction,
} from "components/screens/EarnScreen/components/EarnDepositDetailsBottomSheet";
import {
  PositionSection,
  SM_LINE_HEIGHT,
} from "components/screens/PositionsScreen/components/PositionParts";
import { formatActivityDate } from "components/screens/PositionsScreen/helpers/formatActivityDate";
import {
  PositionActivityItem,
  PositionActivityType,
} from "components/screens/PositionsScreen/helpers/positionActivity";
import {
  PositionTokenRow,
  getPositionRowToken,
  toDisplayTokens,
} from "components/screens/PositionsScreen/helpers/positionRows";
import { usePositionActivity } from "components/screens/PositionsScreen/hooks/usePositionActivity";
import { Text } from "components/sds/Typography";
import { NetworkDetails } from "config/constants";
import { fsValue } from "helpers/dimensions";
import { NO_FIAT_VALUE, formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import {
  trackPositionsActivityDetailsAction,
  trackPositionsActivityRowSelected,
} from "services/analytics/positions";

const ICON_SIZE = 40;
/** The token sits 2.5pt in from the icon's edge, at 35pt. */
const TOKEN_SCALE = 35 / 40;
const BADGE_SIZE = 20;

/** The protocol's site, under each row's title. */
const PROTOCOL_SITES: Record<PositionActivityItem["protocol"], string> = {
  blend: "blend.capital",
};

interface PositionActivityListProps {
  row: PositionTokenRow;
  publicKey: string;
  networkDetails: NetworkDetails;
}

/**
 * The Activity list on a supplied token's position screen: each deposit and
 * withdrawal, newest first, each opening its record in the sheet the deposit
 * flow shows after a deposit.
 *
 * Renders nothing until there is something to list. The interim source only
 * reaches the account's latest operations, so an empty result does not mean
 * the position has no history; the design has no empty state to say so.
 */
export const PositionActivityList: React.FC<PositionActivityListProps> = ({
  row,
  publicKey,
  networkDetails,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const items = usePositionActivity({
    poolId: row.poolId,
    assetId: row.assetId,
    publicKey,
    networkDetails,
  });
  const [selected, setSelected] = useState<PositionActivityItem | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const token = useMemo(() => getPositionRowToken(row), [row]);

  // What every Activity event reports about the row it came from.
  const eventProps = useCallback(
    (item: PositionActivityItem) => ({
      poolId: row.poolId,
      protocol: item.protocol,
      assetCode: row.code,
      activityType: item.type,
    }),
    [row.poolId, row.code],
  );

  const handleRowPress = useCallback(
    (item: PositionActivityItem) => {
      trackPositionsActivityRowSelected(eventProps(item));
      setSelected(item);
      sheetRef.current?.present();
    },
    [eventProps],
  );

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleAction = useCallback(
    (action: EarnDetailsAction) => {
      if (selected) {
        trackPositionsActivityDetailsAction({
          ...eventProps(selected),
          action,
        });
      }
    },
    [selected, eventProps],
  );

  if (!items?.length) {
    return null;
  }

  return (
    <PositionSection
      title={t("positions.tokenScreen.activity")}
      testID="position-activity"
    >
      <View>
        {items.map((item, index) => {
          const isDeposit = item.type === PositionActivityType.DEPOSIT;
          // The items carry integer amounts in the token's smallest unit.
          const tokens = toDisplayTokens(item.amount, row.decimals);
          const amountColor = isDeposit
            ? themeColors.green[11]
            : themeColors.text.secondary;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleRowPress(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              className="flex-row items-center gap-[16px] py-[12px]"
              style={
                index < items.length - 1
                  ? {
                      borderBottomWidth: 1,
                      borderBottomColor: themeColors.border.primary,
                    }
                  : undefined
              }
              testID="position-activity-row"
            >
              <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
                <View style={{ transform: [{ scale: TOKEN_SCALE }] }}>
                  <TokenIcon token={token} size="lg" />
                </View>
                {/* The protocol's icon on a page-colored disc over the
                    token's bottom-left quarter. */}
                <View
                  className="absolute bottom-0 left-0 rounded-full"
                  style={{
                    width: BADGE_SIZE,
                    height: BADGE_SIZE,
                    backgroundColor: themeColors.background.primary,
                  }}
                >
                  <BlendPoolIcon
                    style={{
                      width: BADGE_SIZE,
                      height: BADGE_SIZE,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
              <View className="flex-1 gap-[2px]">
                <Text md semiBold primary>
                  {isDeposit
                    ? t("positions.activity.deposit")
                    : t("positions.activity.withdraw")}
                </Text>
                <Text
                  sm
                  medium
                  secondary
                  style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
                >
                  {PROTOCOL_SITES[item.protocol]}
                </Text>
              </View>
              <View className="items-end gap-[2px]">
                <Text
                  md
                  semiBold
                  color={amountColor}
                  testID="position-activity-amount"
                >
                  {tokens === null
                    ? NO_FIAT_VALUE
                    : `${isDeposit ? "+" : "-"}${formatTokenForDisplay(
                        tokens,
                        row.code,
                      )}`}
                </Text>
                <Text
                  sm
                  medium
                  secondary
                  style={{ lineHeight: fsValue(SM_LINE_HEIGHT) }}
                >
                  {formatActivityDate(item.occurredAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <BottomSheet
        modalRef={sheetRef}
        bottomSheetModalProps={{ onDismiss: () => setSelected(null) }}
        customContent={
          selected ? (
            <EarnDepositDetailsBottomSheet
              // A fresh sheet per event: its network read is keyed on the hash.
              key={selected.id}
              type={
                selected.type === PositionActivityType.WITHDRAW
                  ? "withdraw"
                  : "deposit"
              }
              tokenAmount={toDisplayTokens(selected.amount, row.decimals)}
              tokenCode={row.code}
              token={token}
              poolName={row.poolName}
              transactionHash={selected.txHash}
              transactionXdr={selected.envelopeXdr}
              occurredAt={selected.occurredAt}
              onClose={handleClose}
              onAction={handleAction}
            />
          ) : null
        }
      />
    </PositionSection>
  );
};
