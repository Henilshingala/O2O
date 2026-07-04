const API_BASE = window.location.origin + "/api/admin";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(fetchOptions.headers as Record<string, string> || {}) };

  if (!skipAuth) {
    const token = localStorage.getItem("admin_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...fetchOptions, headers });

  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T = any>(url: string) => apiClient<T>(url),
  post: <T = any>(url: string, data?: any) => apiClient<T>(url, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T = any>(url: string, data?: any) => apiClient<T>(url, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  del: <T = any>(url: string) => apiClient<T>(url, { method: "DELETE" }),
  login: (email: string, password: string) => apiClient<{ token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }), skipAuth: true }),
};
