// eslint-disable-next-line import/no-extraneous-dependencies
import { RenderAPI, render } from "@testing-library/react-native";
import i18n from "i18n";
import React from "react";
import { I18nextProvider } from "react-i18next";

type RenderWithProviderType = (component: React.ReactElement) => RenderAPI;

jest.mock("helpers/get-os-language");

export const renderWithProviders: RenderWithProviderType = (component) =>
  render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
