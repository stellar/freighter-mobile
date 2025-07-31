import React from "react";
import type { ComponentProps } from "react";
import { View } from "react-native";

export const WebView = (props: ComponentProps<typeof View>) => (
  <View {...props} />
);
export const WebViewNavigation = {};
export default WebView;
