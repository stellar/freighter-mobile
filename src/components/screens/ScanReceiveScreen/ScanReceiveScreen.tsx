import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { ReceiveTabView } from "components/screens/ScanReceiveScreen/ReceiveTabView";
import { ScanTabView } from "components/screens/ScanReceiveScreen/ScanTabView";
import Icon from "components/sds/Icon";
import Tabs from "components/sds/Tabs";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_PADDING } from "config/constants";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  ScanReceiveTab,
} from "config/routes";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useClearTransitionParam } from "hooks/useClearTransitionParam";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { track } from "services/analytics/core";

type ScanReceiveScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN
>;

const MIN_INSETS_TOP = 34;
const HEADER_BUTTON_SIZE = 40;
const HEADER_BOTTOM_PADDING = 16;
const FADE_DURATION_MS = 200;

/**
 * ScanReceiveScreen
 *
 * Unified screen with a camera Scan tab and an account-QR Receive tab, switched
 * via the Tabs control in a floating header. The opaque Receive layer crossfades
 * over the camera; the camera is paused while Receive is active. Per-tab
 * screen-view analytics are fired manually.
 */
const ScanReceiveScreen: React.FC<ScanReceiveScreenProps> = ({
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  useClearTransitionParam(navigation, route.params?.transition);

  const initialTab: ScanReceiveTab = route.params?.initialTab ?? "scan";
  const [activeTab, setActiveTab] = useState<ScanReceiveTab>(initialTab);

  const receiveAnim = useRef(
    new Animated.Value(initialTab === "receive" ? 1 : 0),
  ).current;

  // Crossfade the opaque Receive layer over the camera.
  useEffect(() => {
    Animated.timing(receiveAnim, {
      toValue: activeTab === "receive" ? 1 : 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [activeTab, receiveAnim]);

  // Per-tab screen-view analytics (preserves prior per-screen tracking): fires
  // on initial mount and on every tab switch.
  useEffect(() => {
    track(
      activeTab === "receive"
        ? AnalyticsEvent.VIEW_ACCOUNT_QR_CODE
        : AnalyticsEvent.VIEW_SCAN_QR_CODE,
    );
  }, [activeTab]);

  const insetsTop = insets.top || pxValue(MIN_INSETS_TOP - DEFAULT_PADDING);
  const headerPaddingTop = insetsTop + pxValue(DEFAULT_PADDING);
  const headerHeight =
    headerPaddingTop + pxValue(HEADER_BUTTON_SIZE + HEADER_BOTTOM_PADDING);

  const tabOptions = useMemo(
    () => [
      { label: t("scanReceiveScreen.scanTab"), value: "scan" },
      { label: t("scanReceiveScreen.receiveTab"), value: "receive" },
    ],
    [t],
  );

  const isScan = activeTab === "scan";

  return (
    <View className="flex-1 bg-background-primary">
      {/* Scan layer (camera) */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isScan ? "auto" : "none"}
      >
        <ScanTabView
          cameraActive={isFocused}
          isScanning={isFocused && isScan}
        />
      </View>

      {/* Receive layer (opaque; fades in over the camera) */}
      <Animated.View
        className="bg-background-primary"
        style={[StyleSheet.absoluteFill, { opacity: receiveAnim }]}
        pointerEvents={isScan ? "none" : "auto"}
      >
        <View
          style={{
            flex: 1,
            paddingTop: headerHeight,
            paddingBottom: insets.bottom,
          }}
        >
          <ReceiveTabView />
        </View>
      </Animated.View>

      {/* Floating header: X close + centered Tabs */}
      <View
        className="absolute left-0 right-0 z-[999] flex-row items-center px-6 pb-4"
        style={{ paddingTop: headerPaddingTop }}
      >
        <CustomHeaderButton
          icon={Icon.X}
          onPress={() => navigation.goBack()}
          testID="scan-receive-close-button"
        />
        <View className="flex-1 flex-row items-center justify-center">
          <Tabs
            options={tabOptions}
            selectedValue={activeTab}
            onValueChange={(value) => setActiveTab(value as ScanReceiveTab)}
          />
        </View>
        {/* Spacer mirroring the close button so the Tabs stay centered. */}
        <View className="w-10 h-10" />
      </View>
    </View>
  );
};

export default ScanReceiveScreen;
