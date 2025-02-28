jest.mock("helpers/get-os-language", () =>
  jest.fn().mockImplementationOnce(() => "en"),
);
