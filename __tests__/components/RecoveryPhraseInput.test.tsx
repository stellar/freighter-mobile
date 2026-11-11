import { act, render, fireEvent } from "@testing-library/react-native";
import { RecoveryPhraseInput } from "components/RecoveryPhraseInput";
import React, { useState } from "react";

const mask = (text: string) => text.replace(/\S/g, "•");

/**
 * The input holding `phrase`, with its value kept by the caller, as
 * RecoveryPhraseField keeps it. `phrase()` reads what the caller holds.
 */
const renderPhrase = (initialPhrase: string, showMasked = true) => {
  let held = initialPhrase;
  const Caller = () => {
    const [value, setValue] = useState(initialPhrase);
    return (
      <RecoveryPhraseInput
        testID="phrase-input"
        value={value}
        showMasked={showMasked}
        setValue={(text) => {
          held = text;
          setValue(text);
        }}
      />
    );
  };
  const screen = render(<Caller />);
  const input = () => screen.getByTestId("phrase-input");

  return {
    input,
    phrase: () => held,
    shown: () => input().props.value as string,
    // What the field reports as the user edits: where the caret or
    // selection is, the key they press, and the text that results.
    select: (start: number, end = start) =>
      fireEvent(input(), "selectionChange", {
        nativeEvent: { selection: { start, end } },
      }),
    press: (key: string) =>
      fireEvent(input(), "keyPress", { nativeEvent: { key } }),
    type: (text: string) => fireEvent.changeText(input(), text),
  };
};

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
      "••••••• ••••••• •••• ••••• ••••• •••••• •••••• •••••••• •••••• ••••• •••••• ••••••••";
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
      "••••••• ••••••• •••• ••••• ••••• •••••• •••••• •••••••• •••••• ••••• •••••• ••••••••";
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
    const expectedValue = "••••••• ••••••• ••••";
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
    const maskedValue = "••••• ••••• •••••";
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
    const maskedValue = "•••••••";
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
    const maskedValue = "••••••• ••••••• ••••";
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

  it("tells the caller when it gains and loses focus", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { getByTestId } = render(
      <RecoveryPhraseInput
        value=""
        setValue={jest.fn()}
        testID="masked-input"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = getByTestId("masked-input");

    // Calls the TextInput's own handlers: fireEvent would also find the ones
    // given to RecoveryPhraseInput itself, whether it passes them on or not.
    act(() => {
      input.props.onFocus?.();
      input.props.onBlur?.();
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  // Each change is placed where it happened in the phrase, so fixing one word
  // leaves the others as they are.
  describe("editing anywhere in the phrase", () => {
    it("fixes a word in the middle of the shown phrase", () => {
      const field = renderPhrase("abandon abilty able", false);

      field.type("abandon ability able");

      expect(field.phrase()).toBe("abandon ability able");
      expect(field.shown()).toBe("abandon ability able");
    });

    it("inserts a letter typed in the middle of the masked phrase", () => {
      const field = renderPhrase("abandon abilty able");
      const shown = field.shown();

      field.select(12);
      field.press("i");
      field.type(`${shown.slice(0, 12)}i${shown.slice(12)}`);

      expect(field.phrase()).toBe("abandon ability able");
      expect(field.shown()).toBe(mask("abandon ability able"));
    });

    it("deletes the letter before the caret, wherever it is in the masked phrase", () => {
      const field = renderPhrase("abandon abiility able");
      const shown = field.shown();

      // After the second "i" of "abiility".
      field.select(12);
      field.press("Backspace");
      field.type(shown.slice(0, 11) + shown.slice(12));

      expect(field.phrase()).toBe("abandon ability able");
    });

    it("replaces a selected word with what's pasted over it", () => {
      const field = renderPhrase("abandon wrong able");
      const shown = field.shown();

      field.select(8, 13);
      field.type(`${shown.slice(0, 8)}ability${shown.slice(13)}`);

      expect(field.phrase()).toBe("abandon ability able");
    });

    it("adds pasted words after the ones already typed", () => {
      const field = renderPhrase("abandon");

      field.type(`${field.shown()} ability able`);

      expect(field.phrase()).toBe("abandon ability able");
      expect(field.shown()).toBe(mask("abandon ability able"));
    });
  });
});
