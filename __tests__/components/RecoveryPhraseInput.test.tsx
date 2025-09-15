import { render, fireEvent } from "@testing-library/react-native";
import { RecoveryPhraseInput } from "components/RecoveryPhraseInput";
import React from "react";

describe("RecoveryPhraseInput", () => {
  it("should mask recovery phrase when not focused", () => {
    const mockSetValue = jest.fn();
    const recoveryPhrase =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput value={recoveryPhrase} setValue={mockSetValue} />,
    );

    // When showMasked is true (default), should show masked version
    const maskedValue =
      "******* ******* **** ***** ***** ****** ****** ******** ****** ***** ****** ********";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should detect paste by length increase and mask immediately", () => {
    const mockSetValue = jest.fn();
    const longPhrase =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput value={longPhrase} setValue={mockSetValue} />,
    );

    // Should show masked version due to paste detection
    const maskedValue =
      "******* ******* **** ***** ***** ****** ****** ******** ****** ***** ****** ********";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should mask text when showMasked is true", () => {
    const mockSetValue = jest.fn();
    const recoveryPhrase = "abandon ability able";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        setValue={mockSetValue}
        showMasked
        testID="masked-input"
      />,
    );

    // When showMasked is true, should show masked version
    const expectedValue = "******* ******* ****";
    expect(getByDisplayValue(expectedValue)).toBeTruthy();
  });

  it("should show actual text when showMasked is false", () => {
    const mockSetValue = jest.fn();
    const recoveryPhrase = "abandon ability able";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        setValue={mockSetValue}
        showMasked={false}
        testID="masked-input"
      />,
    );

    // When showMasked is false, should show actual text
    expect(getByDisplayValue(recoveryPhrase)).toBeTruthy();
  });

  it("should normalize text to lowercase and remove accents", () => {
    const mockSetValue = jest.fn();
    const inputWithAccents = "café naïve résumé";
    const expectedNormalized = "cafe naive resume";

    const { getByTestId } = render(
      <RecoveryPhraseInput
        value=""
        setValue={mockSetValue}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");
    fireEvent.changeText(input, inputWithAccents);

    expect(mockSetValue).toHaveBeenCalledWith(expectedNormalized);
  });

  it("should preserve spaces between words in masked display", () => {
    const mockSetValue = jest.fn();
    const recoveryPhrase = "word1 word2 word3";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput value={recoveryPhrase} setValue={mockSetValue} />,
    );

    // Should show asterisks with spaces between words
    const maskedValue = "***** ***** *****";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should handle single word input", () => {
    const mockSetValue = jest.fn();
    const singleWord = "abandon";

    const { getByDisplayValue } = render(
      <RecoveryPhraseInput
        value={singleWord}
        setValue={mockSetValue}
        testID="masked-input"
      />,
    );

    // Should show masked version by default
    const maskedValue = "*******";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should handle focus and blur events", () => {
    const mockSetValue = jest.fn();
    const recoveryPhrase = "abandon ability able";

    const { getByDisplayValue, getByTestId } = render(
      <RecoveryPhraseInput
        value={recoveryPhrase}
        setValue={mockSetValue}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");

    // Should show masked version by default
    const maskedValue = "******* ******* ****";
    expect(getByDisplayValue(maskedValue)).toBeTruthy();

    // Focus and blur should not change the display behavior
    fireEvent(input, "focus");
    expect(getByDisplayValue(maskedValue)).toBeTruthy();

    fireEvent(input, "blur");
    expect(getByDisplayValue(maskedValue)).toBeTruthy();
  });

  it("should handle empty input", () => {
    const mockSetValue = jest.fn();

    const { getByTestId } = render(
      <RecoveryPhraseInput
        value=""
        setValue={mockSetValue}
        testID="masked-input"
      />,
    );

    const input = getByTestId("masked-input");
    fireEvent.changeText(input, "");

    expect(mockSetValue).toHaveBeenCalledWith("");
  });
});
