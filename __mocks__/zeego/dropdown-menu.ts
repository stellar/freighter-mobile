import React from "react";
import { View } from "react-native";

const mockComponent = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(View, {}, children);

const mockCreate = (component: React.ComponentType) => component;

export const Root = mockComponent;
export const Trigger = mockComponent;
export const Content = mockComponent;
export const Item = mockComponent;
export const ItemTitle = mockComponent;
export const ItemIcon = mockComponent;
export const Group = mockComponent;
export const Separator = mockComponent;
export const create = mockCreate;
