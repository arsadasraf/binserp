import { API_BASE_URL } from "@/src/utils/config";

interface FetchOptions extends RequestInit {
  token?: string | null;
}

export const apiRequest = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Only set Content-Type to application/json if body is not FormData
  if (!(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    return response;
  } catch (error) {
    console.error("API Request Error:", error);
    throw new Error("Network error. Please check your connection and try again.");
  }
};

export const apiGet = async (endpoint: string, token?: string | null) => {
  const response = await apiRequest(endpoint, {
    method: "GET",
    token,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const apiPost = async (endpoint: string, data: any, token?: string | null) => {
  const isFormData = data instanceof FormData;
  const response = await apiRequest(endpoint, {
    method: "POST",
    body: isFormData ? data : JSON.stringify(data),
    token,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const apiPut = async (endpoint: string, data: any, token?: string | null) => {
  const isFormData = data instanceof FormData;
  const response = await apiRequest(endpoint, {
    method: "PUT",
    body: isFormData ? data : JSON.stringify(data),
    token,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const apiDelete = async (endpoint: string, token?: string | null) => {
  const response = await apiRequest(endpoint, {
    method: "DELETE",
    token,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

