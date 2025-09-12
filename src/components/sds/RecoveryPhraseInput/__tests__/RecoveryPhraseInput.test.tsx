import { render, fireEvent } from "@testing-library/react-native";
import { RecoveryPhraseInput } from "components/sds/RecoveryPhraseInput";
import React from "react";

describe("RecoveryPhraseInput", () => {
  it("should mask recovery phrase when not focused", () => {
    const mockOnChangeText = jest.fn();
    const recoveryPhrase =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        onChangeText={mockOnChangeText}
      />,
    );

    // When not focused, should show masked version
    const maskedValue =
      "******* ******* **** ***** ***** ****** ****** ******** ****** ***** ****** ********";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should detect paste by length increase and mask immediately", () => {
    const mockOnChangeText = jest.fn();
    const longPhrase =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={longPhrase}
        onChangeText={mockOnChangeText}
      />,
    );

    // Should show masked version due to paste detection
    const maskedValue =
      "******* ******* **** ***** ***** ****** ****** ******** ****** ***** ****** ********";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should mask completed words but show current word when focused and typing", () => {
    const mockOnChangeText = jest.fn();
    const recoveryPhrase = "abandon ability able";

    const { getByDisplayValue, getByTestId } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        onChangeText={mockOnChangeText}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");

    // Focus the input to trigger typing state
    fireEvent(input, "focus");

    // Simulate typing by changing text
    fireEvent.changeText(input, recoveryPhrase);

    // When focused and typing, should mask completed words but show current word
    const expectedValue = "******* ******* able";
    expect(getByDisplayValue(expectedValue)).toBeTruthy();
  });

  it("should normalize text to lowercase and remove accents", () => {
    const mockOnChangeText = jest.fn();
    const inputWithAccents = "café naïve résumé";
    const expectedNormalized = "cafe naive resume";

    const { getByTestId } = render(
      <RecoveryPhraseInput
        value=""
        onChangeText={mockOnChangeText}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");
    fireEvent.changeText(input, inputWithAccents);

    expect(mockOnChangeText).toHaveBeenCalledWith(expectedNormalized);
  });

  it("should preserve spaces between words in masked display", () => {
    const mockOnChangeText = jest.fn();
    const recoveryPhrase = "word1 word2 word3";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        onChangeText={mockOnChangeText}
      />,
    );

    // Should show asterisks with spaces between words
    const maskedValue = "***** ***** *****";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should show single word when typing", () => {
    const mockOnChangeText = jest.fn();
    const singleWord = "abandon";

    const { getByDisplayValue, getByTestId } = render(
      <RecoveryPhraseInput
        value={singleWord}
        onChangeText={mockOnChangeText}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");

    // Focus the input to trigger typing state
    fireEvent(input, "focus");

    // Simulate typing by changing text
    fireEvent.changeText(input, singleWord);

    // When typing a single word, should show the actual word
    expect(getByDisplayValue(singleWord)).toBeTruthy();
  });

  it("should handle focus and blur events", () => {
    const mockOnChangeText = jest.fn();
    const recoveryPhrase = "abandon ability able";

    const { getByDisplayValue, getByTestId } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        onChangeText={mockOnChangeText}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");

    // Initially should show fully masked version when not focused
    const fullyMaskedValue = "******* ******* ****";
    expect(getByDisplayValue(fullyMaskedValue)).toBeTruthy();

    // Focus should trigger typing state - show partial masking
    fireEvent(input, "focus");
    fireEvent.changeText(input, recoveryPhrase);
    const partialMaskedValue = "******* ******* able";
    expect(getByDisplayValue(partialMaskedValue)).toBeTruthy();

    // Blur should return to fully masked state
    fireEvent(input, "blur");
    expect(getByDisplayValue(fullyMaskedValue)).toBeTruthy();
  });

  it("should handle empty input", () => {
    const mockOnChangeText = jest.fn();

    const { getByTestId } = render(
      <RecoveryPhraseInput
        value=""
        onChangeText={mockOnChangeText}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");
    fireEvent.changeText(input, "");

    expect(mockOnChangeText).toHaveBeenCalledWith("");
  });
});
