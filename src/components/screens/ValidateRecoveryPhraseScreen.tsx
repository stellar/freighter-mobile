/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { WordBubble } from "components/WordBubble";
import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { VALIDATION_WORDS_PER_ROW } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useWordSelection } from "hooks/useWordSelection";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
} from "react";
import { View, FlatList } from "react-native";
import { analytics } from "services/analytics";

type ValidateRecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN
>;

export const ValidateRecoveryPhraseScreen: React.FC<
  ValidateRecoveryPhraseScreenProps
> = ({ route, navigation }) => {
  const { password, recoveryPhrase } = route.params;
  const [selectedWord, setSelectedWord] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const isSigningUp = useAuthenticationStore((state) => state.isLoading);
  const [roundIndex, setRoundIndex] = useState(0);
  const [isRegeneratingWords, setIsRegeneratingWords] = useState(false);

  const { signUp } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const { words, selectedIndexes, generateWordOptionsForRound } =
    useWordSelection(recoveryPhrase);
  const currentWordIndex = selectedIndexes[roundIndex];
  const currentCorrectWord = words[currentWordIndex];

  const [currentRoundWordOptions, setCurrentRoundWordOptions] = useState<
    string[]
  >([]);

  const regenerateWords = useCallback(() => {
    setIsRegeneratingWords(true);

    const newWordOptions = generateWordOptionsForRound(roundIndex);
    setCurrentRoundWordOptions(newWordOptions);

    setIsRegeneratingWords(false);
    setSelectedWord("");
  }, [generateWordOptionsForRound, roundIndex]);

  // Initialize word options when component mounts or round changes
  useEffect(() => {
    const newWordOptions = generateWordOptionsForRound(roundIndex);

    setCurrentRoundWordOptions(newWordOptions);
  }, [generateWordOptionsForRound, roundIndex]);

  const canContinue = useMemo(
    () => selectedWord === currentCorrectWord,
    [selectedWord, currentCorrectWord],
  );

  const handleWordSelect = useCallback((word: string) => {
    setSelectedWord(word);
    setError(undefined);
  }, []);

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      // Word is incorrect - show error and generate new words
      setError(t("validateRecoveryPhraseScreen.errorText"));
      analytics.track(AnalyticsEvent.CONFIRM_RECOVERY_PHRASE_FAIL);

      regenerateWords();
      return;
    }

    // Word is correct - proceed to next round
    setIsLoading(true);

    if (roundIndex < 2) {
      setRoundIndex(roundIndex + 1);
      setSelectedWord("");
      setError(undefined);
    } else {
      signUp({
        password,
        mnemonicPhrase: recoveryPhrase,
      });
    }

    setIsLoading(false);
  }, [
    canContinue,
    roundIndex,
    password,
    recoveryPhrase,
    signUp,
    t,
    regenerateWords,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <CustomHeaderButton
          position="left"
          onPress={() => {
            analytics.track(
              AnalyticsEvent.ACCOUNT_CREATOR_CONFIRM_MNEMONIC_BACK,
            );

            navigation.goBack();
          }}
        />
      ),
    });
  }, [navigation]);

  return (
    <OnboardLayout
      icon={<Icon.Passcode circle />}
      title={t("validateRecoveryPhraseScreen.title", {
        number: selectedIndexes[roundIndex] + 1,
      })}
      isDefaultActionButtonDisabled={!selectedWord || isLoading || isSigningUp}
      defaultActionButtonText={t(
        "validateRecoveryPhraseScreen.defaultActionButtonText",
      )}
      onPressDefaultActionButton={handleContinue}
      isLoading={isLoading || isSigningUp}
    >
      <View className="mb-6 gap-[24px]">
        <Text secondary regular>
          {t("validateRecoveryPhraseScreen.instructionText")}
        </Text>

        {/* Word Selection Grid via FlatList: 3 items per row. negative horizontal margin to remove padding in the sides */}
        <View className="-mx-2">
          <FlatList
            data={currentRoundWordOptions}
            keyExtractor={(word, index) => `${roundIndex}-${word}-${index}`}
            numColumns={VALIDATION_WORDS_PER_ROW}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View className="h-[16px]" />}
            renderItem={({ item: word }) => (
              <View className="flex-1 px-2">
                <WordBubble
                  word={word}
                  isSelected={selectedWord === word}
                  onPress={() => handleWordSelect(word)}
                  testID={`word-bubble-${word}`}
                  disabled={isRegeneratingWords}
                  size="lg"
                />
              </View>
            )}
          />
        </View>

        {/* Error Message */}
        {error && <Text color={themeColors.red[11]}>{error}</Text>}
      </View>
    </OnboardLayout>
  );
};
