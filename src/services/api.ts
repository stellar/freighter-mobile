import { useIsOffline } from "ducks/networkInfo";

interface ApiOptions extends RequestInit {
  timeout?: number;
}

export class NetworkError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "NetworkError";
  }
}

export const fetchWithTimeout = async (
  url: string,
  options: ApiOptions = {},
): Promise<Response> => {
  const { timeout = 15000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!response.ok) {
      throw new NetworkError(
        `Network response was not ok: ${response.status}`,
        response.status,
      );
    }

    return response;
  } catch (error) {
    clearTimeout(id);

    if (error instanceof Error && error.name === "AbortError") {
      throw new NetworkError("Request timeout", 408);
    }

    throw error;
  }
};

export const apiGet = async <T>(
  url: string,
  options?: ApiOptions,
): Promise<T> => {
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = (await response.json()) as T;
  return data;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiPost = async <T>(
  url: string,
  data: any,
  options?: ApiOptions,
): Promise<T> => {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    ...options,
  });

  const responseData = (await response.json()) as T;
  return responseData;
};

// Hook to check if offline before making requests
export const useApi = () => {
  const isOffline = useIsOffline();

  const checkConnection = () => {
    if (isOffline) {
      throw new Error("No internet connection");
    }
  };

  return {
    get: async <T>(url: string, options?: ApiOptions): Promise<T> => {
      checkConnection();
      return apiGet<T>(url, options);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    post: async <T>(
      url: string,
      data: any,
      options?: ApiOptions,
    ): Promise<T> => {
      checkConnection();
      return apiPost<T>(url, data, options);
    },
  };
};
