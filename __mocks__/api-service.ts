import { AxiosInstance } from "axios";
import { ApiResponse, RequestConfig } from "services/apiFactory";

type GetFn = <T>(
  url: string,
  config?: RequestConfig,
) => Promise<ApiResponse<T>>;
type PostFn = <T, D = unknown>(
  url: string,
  data?: D,
  config?: RequestConfig,
) => Promise<ApiResponse<T>>;
type PutFn = <T, D = unknown>(
  url: string,
  data?: D,
  config?: RequestConfig,
) => Promise<ApiResponse<T>>;
type DeleteFn = <T>(
  url: string,
  config?: RequestConfig,
) => Promise<ApiResponse<T>>;

export const mockApiService = {
  get: jest.fn() as jest.MockedFunction<GetFn>,
  post: jest.fn() as jest.MockedFunction<PostFn>,
  put: jest.fn() as jest.MockedFunction<PutFn>,
  delete: jest.fn() as jest.MockedFunction<DeleteFn>,
  setAuthToken: jest.fn(),
  getInstance: () => ({ getUri: () => "mock://uri" }) as AxiosInstance,
};
