import { API_BASE_URL, getApiBaseUrl } from "@/src/utils/config";

interface FetchOptions extends RequestInit {
  token?: string | null;
  _retry?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const apiRequest = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const { token, _retry, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Only set Content-Type to application/json if body is not FormData
  if (!(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Resolve token from parameter or localStorage fallback
  const activeToken =
    token !== undefined
      ? token
      : typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const baseUrl = typeof window !== "undefined" ? getApiBaseUrl() : API_BASE_URL;
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      credentials: "include", // Send HttpOnly cookies automatically
      ...fetchOptions,
      headers,
    });

    // Handle 401 Token Expiration with automated silent refresh
    if (
      response.status === 401 &&
      !_retry &&
      !endpoint.includes("/login") &&
      !endpoint.includes("/refresh")
    ) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          return apiRequest(endpoint, {
            ...options,
            token: newToken || activeToken,
            _retry: true,
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
        const storedRefreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
        const refreshRes = await fetch(refreshUrl, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(storedRefreshToken ? { "x-refresh-token": storedRefreshToken } : {})
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const newToken = data.token;
          if (newToken && typeof window !== "undefined") {
            localStorage.setItem("token", newToken);
            const isSecure = window.location.protocol === "https:";
            document.cookie = `accessToken=${encodeURIComponent(newToken)}; max-age=${12 * 60 * 60}; path=/; SameSite=Lax; ${isSecure ? "Secure" : ""}`;
          }
          if (data.refreshToken && typeof window !== "undefined") {
            localStorage.setItem("refreshToken", data.refreshToken);
          }
          isRefreshing = false;
          processQueue(null, newToken);

          return apiRequest(endpoint, {
            ...options,
            token: newToken || activeToken,
            _retry: true,
          });
        } else {
          isRefreshing = false;
          processQueue(new Error("Refresh failed"), null);
          return response;
        }
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);
        return response;
      }
    }

    return response;
  } catch (error: any) {
    console.warn("API Request Error:", error?.message || error);
    throw new Error(error?.message || "Network error. Please check your connection and try again.");
  }
};

const handleApiResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    if (isJson) {
      try {
        const error = await response.json();
        if (error && error.message) errorMsg = error.message;
      } catch {}
    } else {
      try {
        const text = await response.text();
        if (text && text.length < 200 && !text.includes("<")) errorMsg = text;
      } catch {}
    }
    throw new Error(errorMsg);
  }

  if (isJson) {
    return response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { data: text, raw: text };
  }
};

export const apiGet = async (endpoint: string, token?: string | null) => {
  const response = await apiRequest(endpoint, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

export const apiPost = async (endpoint: string, data: any, token?: string | null) => {
  const isFormData = data instanceof FormData;
  const response = await apiRequest(endpoint, {
    method: "POST",
    body: isFormData ? data : JSON.stringify(data),
    token,
  });

  return handleApiResponse(response);
};

export const apiPut = async (endpoint: string, data: any, token?: string | null) => {
  const isFormData = data instanceof FormData;
  const response = await apiRequest(endpoint, {
    method: "PUT",
    body: isFormData ? data : JSON.stringify(data),
    token,
  });

  return handleApiResponse(response);
};

export const apiPatch = async (endpoint: string, data: any, token?: string | null) => {
  const isFormData = data instanceof FormData;
  const response = await apiRequest(endpoint, {
    method: "PATCH",
    body: isFormData ? data : JSON.stringify(data),
    token,
  });

  return handleApiResponse(response);
};

export const apiDelete = async (endpoint: string, token?: string | null) => {
  const response = await apiRequest(endpoint, {
    method: "DELETE",
    token,
  });

  return handleApiResponse(response);
};


