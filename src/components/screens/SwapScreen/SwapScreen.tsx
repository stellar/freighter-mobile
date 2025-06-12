import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import React from "react";
import { View } from "react-native";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation }) => {
  return <View></View>;
};

export default SwapScreen;