import { CommonActions, NavigationAction } from "@react-navigation/native";
import { useEffect } from "react";

interface CloseWhenGoneParams {
  /** What the screen shows is gone. */
  isGone: boolean;
  navigation: {
    dispatch: (action: NavigationAction) => void;
    getState: () => { key: string };
  };
  /** The calling screen's route. */
  routeKey: string;
}

/**
 * Closes the calling screen once what it shows is gone, wherever it is in
 * the stack. A refresh can drop a pool while its token's screen, or Earn, is
 * open over it, and a plain `goBack()` pops whatever is on top: the back
 * action has to name both this route and its stack to remove this route.
 */
export const useCloseWhenGone = ({
  isGone,
  navigation,
  routeKey,
}: CloseWhenGoneParams) => {
  useEffect(() => {
    if (!isGone) {
      return;
    }
    navigation.dispatch({
      ...CommonActions.goBack(),
      source: routeKey,
      target: navigation.getState().key,
    });
  }, [isGone, navigation, routeKey]);
};
